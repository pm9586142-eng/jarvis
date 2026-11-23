import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

from openjarvis_service.agents_tools import resolve_confined_file, safe_eval_math
from openjarvis_service.intelligence import inspect_hardware, recommend_models
from openjarvis_service.memory import HybridSqliteMemory
from openjarvis_service.server import OpenJarvisServiceState, create_stdlib_server


class TestOpenJarvisPythonService(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmpdir.name, "test_oj.db")
        self.ws_dir = os.path.join(self.tmpdir.name, "ws")
        os.makedirs(self.ws_dir, exist_ok=True)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_ast_math_and_confinement(self):
        self.assertEqual(safe_eval_math("sqrt(144) + 2^3"), 20.0)
        with self.assertRaises(ValueError):
            safe_eval_math("__import__('os').system('echo pwned')")
        with self.assertRaises(ValueError):
            resolve_confined_file("../../etc/passwd", self.ws_dir)
        with self.assertRaises(ValueError):
            resolve_confined_file(".env", self.ws_dir)
        safe = resolve_confined_file("report.md", self.ws_dir)
        self.assertTrue(safe.startswith(os.path.realpath(self.ws_dir)))

    def test_hardware_and_sqlite_hybrid_search(self):
        hw = inspect_hardware()
        self.assertGreaterEqual(hw["cpuCores"], 1)
        models = recommend_models(hw)
        self.assertTrue(any(m["id"] == "gemini-3.8-flash" and m["recommended"] for m in models))

        mem = HybridSqliteMemory(db_path=self.db_path)
        mem.index_document(
            title="SGLang RadixAttention",
            text="SGLang uses RadixAttention KV cache sharing for structured LLM outputs and local agents.",
        )
        for mode in ("bm25", "vector", "colbert", "hybrid"):
            res = mem.search("SGLang RadixAttention", mode=mode)
            self.assertTrue(res["ok"])
            self.assertGreaterEqual(len(res["results"]), 1)
            self.assertEqual(res["results"][0]["title"], "SGLang RadixAttention")

    def test_http_server_health_and_bearer_auth(self):
        old_token = os.environ.get("OPENJARVIS_AUTH_TOKEN")
        os.environ["OPENJARVIS_AUTH_TOKEN"] = "secret-test-token"
        state = OpenJarvisServiceState(db_path=self.db_path, workspace_dir=self.ws_dir)
        server = create_stdlib_server(host="127.0.0.1", port=0, state=state)
        port = server.server_address[1]
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health") as r:
                health = json.loads(r.read().decode("utf-8"))
                self.assertEqual(health["status"], "ok")
                self.assertIn("capabilities", health)

            req_unauth = urllib.request.Request(f"http://127.0.0.1:{port}/v1/models")
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(req_unauth)
            self.assertEqual(ctx.exception.code, 401)

            req_auth = urllib.request.Request(
                f"http://127.0.0.1:{port}/v1/models",
                headers={"Authorization": "Bearer secret-test-token"},
            )
            with urllib.request.urlopen(req_auth) as r2:
                models_json = json.loads(r2.read().decode("utf-8"))
                self.assertTrue(models_json["ok"])
        finally:
            server.shutdown()
            server.server_close()
            if old_token is None:
                os.environ.pop("OPENJARVIS_AUTH_TOKEN", None)
            else:
                os.environ["OPENJARVIS_AUTH_TOKEN"] = old_token


if __name__ == "__main__":
    unittest.main()
