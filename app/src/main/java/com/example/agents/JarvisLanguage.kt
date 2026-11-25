package com.example.agents

enum class JarvisLanguage(
    val displayName: String,
    val localeTag: String,
    val greeting: String
) {
    ENGLISH(
        displayName = "English (UK/US)",
        localeTag = "en",
        greeting = "Hey! AM AI is online and all systems are ready. How can I help today?"
    ),
    HINDI(
        displayName = "हिंदी (Hindi)",
        localeTag = "hi",
        greeting = "नमस्ते! ए एम ए आई ऑनलाइन है और सभी सिस्टम तैयार हैं। बताइए, आज मैं आपकी क्या मदद कर सकती हूँ?"
    ),
    HINGLISH(
        displayName = "Hinglish (Hindi + EN)",
        localeTag = "en-IN",
        greeting = "Hey! AM AI online hai aur sabhi systems ready hain. Bataiye, aaj main aapki kya help kar sakti hoon?"
    ),
    GUJARATI(
        displayName = "ગુજરાતી (Gujarati)",
        localeTag = "gu",
        greeting = "નમસ્તે! AM AI ઓનલાઇન છે અને તમામ સિસ્ટમ તૈયાર છે. આજે હું તમને શું મદદ કરી શકું?"
    )
}
