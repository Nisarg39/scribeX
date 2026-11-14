package com.nashtech.scribex.share

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class ShareIntentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ScribeXShareIntent"
        private const val TAG = "ShareIntentModule"
        private var pendingPayload: WritableMap? = null
        private var activeModule: ShareIntentModule? = null

        fun handleIntent(intent: Intent?, context: Context) {
            if (intent == null) return
            val action = intent.action
            if (Intent.ACTION_SEND != action && Intent.ACTION_SEND_MULTIPLE != action) {
                return
            }

            try {
                val payload = Arguments.createMap()
                val batchId = "share-" + System.currentTimeMillis()
                payload.putString("batchId", batchId)
                payload.putString("createdAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }.format(java.util.Date()))

                val extraText = intent.getStringExtra(Intent.EXTRA_TEXT)
                val extraSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
                if (extraText != null) payload.putString("text", extraText)
                if (extraSubject != null) payload.putString("subject", extraSubject)

                val filesArray = Arguments.createArray()
                val mediaDir = File(context.filesDir, "shared_media").apply {
                    if (!exists()) mkdirs()
                }

                if (Intent.ACTION_SEND == action) {
                    val streamUri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                    }

                    if (streamUri != null) {
                        copyUriToSandbox(context, streamUri, mediaDir)?.let { filesArray.pushMap(it) }
                    } else if (intent.clipData != null && intent.clipData!!.itemCount > 0) {
                        for (i in 0 until intent.clipData!!.itemCount) {
                            val uri = intent.clipData!!.getItemAt(i).uri
                            if (uri != null) {
                                copyUriToSandbox(context, uri, mediaDir)?.let { filesArray.pushMap(it) }
                            }
                        }
                    }
                } else if (Intent.ACTION_SEND_MULTIPLE == action) {
                    val streamUris = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                    }

                    if (streamUris != null) {
                        for (uri in streamUris) {
                            copyUriToSandbox(context, uri, mediaDir)?.let { filesArray.pushMap(it) }
                        }
                    } else if (intent.clipData != null) {
                        for (i in 0 until intent.clipData!!.itemCount) {
                            val uri = intent.clipData!!.getItemAt(i).uri
                            if (uri != null) {
                                copyUriToSandbox(context, uri, mediaDir)?.let { filesArray.pushMap(it) }
                            }
                        }
                    }
                }

                payload.putArray("files", filesArray)
                pendingPayload = payload

                // Clear action so rotation or resume does not re-fire
                intent.action = Intent.ACTION_MAIN

                // Notify JS if module is alive
                activeModule?.sendEvent("onSharePayloadReceived", payload)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle inbound share intent", e)
            }
        }

        private fun copyUriToSandbox(context: Context, uri: Uri, targetDir: File): WritableMap? {
            val contentResolver = context.contentResolver
            var fileName = "shared_${System.currentTimeMillis()}"
            var fileSize = 0L

            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIndex != -1) {
                        val name = cursor.getString(nameIndex)
                        if (!name.isNullOrBlank()) fileName = name
                    }
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIndex != -1) {
                        fileSize = cursor.getLong(sizeIndex)
                    }
                }
            }

            val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
            val sanitizedName = fileName.replace("[^a-zA-Z0-9._-]".toRegex(), "_")
            val destFile = File(targetDir, "${System.currentTimeMillis()}_$sanitizedName")

            try {
                contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(destFile).use { output ->
                        input.copyTo(output)
                    }
                } ?: return null

                val map = Arguments.createMap()
                map.putString("uri", Uri.fromFile(destFile).toString())
                map.putString("fileName", fileName)
                map.putString("mimeType", mimeType)
                map.putDouble("fileSize", destFile.length().toDouble())
                return map
            } catch (e: Exception) {
                Log.e(TAG, "Failed copying stream uri $uri into sandbox", e)
                return null
            }
        }
    }

    override fun initialize() {
        super.initialize()
        activeModule = this
    }

    override fun invalidate() {
        if (activeModule == this) activeModule = null
        super.invalidate()
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun getPendingSharePayload(promise: Promise) {
        val payload = pendingPayload
        pendingPayload = null
        promise.resolve(payload)
    }

    @ReactMethod
    fun clearPendingSharePayload(promise: Promise) {
        pendingPayload = null
        promise.resolve(true)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in Event Emitter
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }
}
