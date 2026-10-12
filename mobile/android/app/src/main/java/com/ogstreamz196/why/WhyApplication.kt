package com.ogstreamz196.why

import android.app.Application
import android.util.Log
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration

/**
 * Configures RevenueCat once, when the app process starts, before the web app
 * loads. The web app then uses the same SDK through the Capacitor plugins: it
 * logs the signed-in user in (their account ID becomes the RevenueCat app user
 * ID), checks the "why_plus_pro" entitlement, shows the RevenueCat Paywall and
 * Customer Center. See docs/WHY_PLUS.md.
 */
class WhyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        val apiKey = BuildConfig.REVENUECAT_API_KEY
        if (apiKey.isBlank()) {
            Log.w(TAG, "No RevenueCat key in this build, so Why? Plus is hidden.")
            return
        }
        // A Test Store key must never reach real users: purchases would be free.
        if (!BuildConfig.DEBUG && apiKey.startsWith("test_")) {
            Log.e(TAG, "Refusing to use a RevenueCat Test Store key in a release build.")
            return
        }

        Purchases.logLevel = if (BuildConfig.DEBUG) LogLevel.DEBUG else LogLevel.WARN
        // Anonymous until the web app calls logIn() with the signed-in account.
        Purchases.configure(PurchasesConfiguration.Builder(this, apiKey).build())
    }

    private companion object {
        const val TAG = "WhyApplication"
    }
}
