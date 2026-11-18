const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_uid_123";
const BOB_UID = "bob_uid_456";

const [emulatorHost, emulatorPortStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085"
).split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

function pastDate(offsetMs = 10000) {
  return new Date(Date.now() - offsetMs);
}

function validTaskCreatePayload(userId, overrides = {}) {
  const nowMs = Date.now() - 5000;
  const ts = pastDate(5000);
  return {
    userId,
    title: "Review Mark 85 Flight Telemetry",
    description: "Analyze thermal dissipation on high-altitude thrusters",
    dueTime: "14:00 Today",
    completed: false,
    deleted: false,
    priority: "HIGH",
    category: "TASK",
    clientCreatedAtMillis: nowMs,
    clientUpdatedAtMillis: nowMs,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function validProfilePayload(userId, overrides = {}) {
  const ts = pastDate(5000);
  return {
    userId,
    displayName: "Tony Stark",
    lastSyncAt: ts,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

// --- UNAUTHENTICATED DENIAL ---

test("Unauthenticated user: cannot read, list, or write users or tasks", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).get());
  await assertFails(unauthDb.collection("users").get());
  await assertFails(
    unauthDb.collection("users").doc(ALICE_UID).collection("tasks").get()
  );
  await assertFails(
    unauthDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("tasks")
      .doc("task_1")
      .set(validTaskCreatePayload(ALICE_UID))
  );
});

// --- USER SYNC PROFILE RULES ---

test("Authenticated owner: valid user sync profile create and heartbeat update succeed; user list denied", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const profileRef = aliceDb.collection("users").doc(ALICE_UID);

  // Listing /users is always denied
  await assertFails(aliceDb.collection("users").get());

  // Create sync profile
  await assertSucceeds(profileRef.set(validProfilePayload(ALICE_UID)));

  // Read own sync profile
  await assertSucceeds(profileRef.get());

  // Heartbeat update preserves immutable userId & createdAt
  await assertSucceeds(
    profileRef.update({
      displayName: "Commander Stark",
      lastSyncAt: pastDate(1000),
      updatedAt: pastDate(1000),
    })
  );

  // Reject ghost field injection
  await assertFails(
    profileRef.update({
      isAdmin: true,
      updatedAt: pastDate(500),
    })
  );

  // Reject createdAt mutation
  await assertFails(
    profileRef.update({
      createdAt: pastDate(500),
      updatedAt: pastDate(500),
    })
  );
});

// --- OWNER TASK LIFECYCLE (MIRRORING KOTLIN REPOSITORY) ---

test("Authenticated owner: valid Kotlin task create, partial update, snooze, tombstone delete, and list succeed", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const tasksCol = aliceDb.collection("users").doc(ALICE_UID).collection("tasks");

  // Empty user-scoped subcollection list query must succeed (no existing() access in allow list)
  await assertSucceeds(tasksCol.get());

  // Create without optional triggerAtMillis (mirrors filterValues { it != null })
  const taskRef = tasksCol.doc("task_sync_001");
  await assertSucceeds(taskRef.set(validTaskCreatePayload(ALICE_UID)));

  // Create with optional triggerAtMillis
  const reminderRef = tasksCol.doc("task_sync_002");
  await assertSucceeds(
    reminderRef.set(
      validTaskCreatePayload(ALICE_UID, {
        title: "Call Raj tomorrow at 5 pm",
        category: "REMINDER",
        triggerAtMillis: Date.now() + 3600000,
      })
    )
  );

  // Partial update: toggle completion + snooze update (mirrors TaskCloudRepository.toUpdateMap)
  await assertSucceeds(
    taskRef.update({
      title: "Review Mark 85 Flight Telemetry",
      description: "Thermal sweep complete",
      dueTime: "Snoozed (15:15)",
      triggerAtMillis: Date.now() + 900000,
      completed: true,
      priority: "HIGH",
      category: "TASK",
      clientUpdatedAtMillis: Date.now() - 1000,
      updatedAt: pastDate(1000),
    })
  );

  // Partial update clearing optional triggerAtMillis to null
  await assertSucceeds(
    taskRef.update({
      triggerAtMillis: null,
      completed: false,
      clientUpdatedAtMillis: Date.now() - 500,
      updatedAt: pastDate(500),
    })
  );

  // Subcollection list + get succeed for owner
  await assertSucceeds(tasksCol.get());
  await assertSucceeds(taskRef.get());

  // Terminal soft-delete tombstone sync succeeds
  await assertSucceeds(
    taskRef.update({
      deleted: true,
      clientUpdatedAtMillis: Date.now() - 250,
      updatedAt: pastDate(250),
    })
  );

  // Terminal state lock: further updates after deleted == true must fail
  await assertFails(
    taskRef.update({
      title: "Resurrected task",
      deleted: false,
      clientUpdatedAtMillis: Date.now() - 100,
      updatedAt: pastDate(100),
    })
  );

  // Owner can still hard-delete own document
  await assertSucceeds(taskRef.delete());
});

// --- CROSS-USER ISOLATION ---

test("Authenticated user: cannot read, list, create, update, or delete another user's profile or tasks", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection("users").doc(BOB_UID).set(validProfilePayload(BOB_UID));
    await db
      .collection("users")
      .doc(BOB_UID)
      .collection("tasks")
      .doc("bob_task_1")
      .set(validTaskCreatePayload(BOB_UID));
  });

  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobTasks = aliceDb.collection("users").doc(BOB_UID).collection("tasks");

  await assertFails(aliceDb.collection("users").doc(BOB_UID).get());
  await assertFails(bobTasks.get());
  await assertFails(bobTasks.doc("bob_task_1").get());
  await assertFails(
    bobTasks.doc("bob_task_1").update({
      title: "Hijacked",
      updatedAt: pastDate(500),
    })
  );
  await assertFails(
    bobTasks.doc("injected_task").set(validTaskCreatePayload(ALICE_UID))
  );
  await assertFails(bobTasks.doc("bob_task_1").delete());
});

// --- RED TEAM: SCHEMA, SHADOW UPDATE, TIMESTAMP & POISONING GUARDS ---

test("Red team guards: reject ghost fields, @DocumentId id key, future timestamps, immutable edits, invalid enums, and oversized strings", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const tasksCol = aliceDb.collection("users").doc(ALICE_UID).collection("tasks");

  // Reject @DocumentId "id" field inside document payload on create
  await assertFails(
    tasksCol.doc("task_bad_id_key").set({
      id: "task_bad_id_key",
      ...validTaskCreatePayload(ALICE_UID),
    })
  );

  // Reject shadow/ghost field on create
  await assertFails(
    tasksCol.doc("task_ghost").set({
      ...validTaskCreatePayload(ALICE_UID),
      isAdmin: true,
    })
  );

  // Reject identity spoofing (userId != auth.uid)
  await assertFails(
    tasksCol.doc("task_spoof").set(validTaskCreatePayload(BOB_UID))
  );

  // Reject tampered future timestamp
  await assertFails(
    tasksCol.doc("task_future").set(
      validTaskCreatePayload(ALICE_UID, {
        createdAt: new Date(Date.now() + 60000),
        updatedAt: new Date(Date.now() + 60000),
      })
    )
  );

  // Reject invalid priority enum casing
  await assertFails(
    tasksCol.doc("task_bad_priority").set(
      validTaskCreatePayload(ALICE_UID, { priority: "high" })
    )
  );

  // Reject invalid category enum
  await assertFails(
    tasksCol.doc("task_bad_cat").set(
      validTaskCreatePayload(ALICE_UID, { category: "UNKNOWN" })
    )
  );

  // Reject oversized title (> 200 chars)
  await assertFails(
    tasksCol.doc("task_long_title").set(
      validTaskCreatePayload(ALICE_UID, { title: "A".repeat(201) })
    )
  );

  // Reject invalid document ID with illegal characters
  await assertFails(
    tasksCol.doc("bad task id!").set(validTaskCreatePayload(ALICE_UID))
  );

  // Seed valid doc to test update guards
  const validRef = tasksCol.doc("task_update_guard");
  await assertSucceeds(validRef.set(validTaskCreatePayload(ALICE_UID)));

  // Reject immutable createdAt mutation
  await assertFails(
    validRef.update({
      createdAt: pastDate(500),
      updatedAt: pastDate(500),
    })
  );

  // Reject immutable clientCreatedAtMillis mutation
  await assertFails(
    validRef.update({
      clientCreatedAtMillis: Date.now() - 100,
      updatedAt: pastDate(500),
    })
  );

  // Reject immutable userId mutation
  await assertFails(
    validRef.update({
      userId: BOB_UID,
      updatedAt: pastDate(500),
    })
  );

  // Reject value poisoning on allowlisted key (non-string title)
  await assertFails(
    validRef.update({
      title: 12345,
      updatedAt: pastDate(500),
    })
  );
});
