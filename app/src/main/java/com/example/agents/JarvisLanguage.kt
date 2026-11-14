package com.example.agents

enum class JarvisLanguage(
    val displayName: String,
    val localeTag: String,
    val greeting: String
) {
    ENGLISH(
        displayName = "English (UK/US)",
        localeTag = "en",
        greeting = "Good day, Sir. JARVIS is online. All available systems are operational. How may I assist you?"
    ),
    HINDI(
        displayName = "हिंदी (Hindi)",
        localeTag = "hi",
        greeting = "नमस्ते सर। जार्विस ऑनलाइन है। सभी प्रणालियां सक्रिय हैं। मैं आपकी क्या सहायता कर सकता हूँ?"
    ),
    GUJARATI(
        displayName = "ગુજરાતી (Gujarati)",
        localeTag = "gu",
        greeting = "નમસ્તે સર. જાર્વિસ ઓનલાઇન છે. તમામ સિસ્ટમ કાર્યરત છે. હું આપને શું મદદ કરી શકું?"
    )
}
