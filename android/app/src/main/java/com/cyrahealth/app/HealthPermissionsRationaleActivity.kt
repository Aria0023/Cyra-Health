package com.cyrahealth.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Health Connect opens this screen when someone taps Cyra's privacy link on the Health Connect
 * permission screen: through androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE (Android 13 and
 * lower) and through the ViewPermissionUsageActivity alias (Android 14+, see AndroidManifest.xml).
 * Static text only; it reads no data. Below the plain-language summary it links to the full
 * privacy policy (the same one as the Play listing, which Health Connect requires) once
 * R.string.privacy_policy_url is set; the link opens in the user's browser and sends nothing.
 */
class HealthPermissionsRationaleActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_health_rationale)

        // targetSdk 36 draws edge to edge on Android 15+: keep text and button clear of system bars.
        val root = findViewById<View>(R.id.rationale_root)
        val left = root.paddingLeft
        val top = root.paddingTop
        val right = root.paddingRight
        val bottom = root.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(left + bars.left, top + bars.top, right + bars.right, bottom + bars.bottom)
            insets
        }

        for (id in intArrayOf(
            R.id.rationale_title,
            R.id.rationale_reads_heading,
            R.id.rationale_why_heading,
            R.id.rationale_where_heading,
            R.id.rationale_control_heading,
        )) {
            ViewCompat.setAccessibilityHeading(findViewById(id), true)
        }

        val policyUrl = getString(R.string.privacy_policy_url).trim()
        if (policyUrl.startsWith("https://")) {
            findViewById<Button>(R.id.rationale_policy).apply {
                visibility = View.VISIBLE
                setOnClickListener {
                    val open = Intent(Intent.ACTION_VIEW, Uri.parse(policyUrl))
                        .addCategory(Intent.CATEGORY_BROWSABLE)
                    try {
                        startActivity(open)
                    } catch (e: ActivityNotFoundException) {
                        Toast.makeText(this@HealthPermissionsRationaleActivity, R.string.hc_rationale_policy_unavailable, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        findViewById<Button>(R.id.rationale_done).setOnClickListener { finish() }
    }
}
