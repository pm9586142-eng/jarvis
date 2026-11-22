package com.example.system

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AndroidNetworkStateManager(context: Context) {
    private val connectivityManager =
        context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

    private val _isOnline = MutableStateFlow(checkCurrentConnectivity())
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _networkLabel = MutableStateFlow(resolveNetworkLabel())
    val networkLabel: StateFlow<String> = _networkLabel.asStateFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            refreshState()
        }

        override fun onLost(network: Network) {
            refreshState()
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            refreshState()
        }
    }

    init {
        try {
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            connectivityManager?.registerNetworkCallback(request, networkCallback)
        } catch (_: Exception) {
            // Robolectric / restricted environments fall back cleanly to synchronous inspection
        }
    }

    fun refreshState() {
        _isOnline.value = checkCurrentConnectivity()
        _networkLabel.value = resolveNetworkLabel()
    }

    private fun checkCurrentConnectivity(): Boolean {
        val cm = connectivityManager ?: return false
        val active = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(active) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun resolveNetworkLabel(): String {
        val cm = connectivityManager ?: return "OFFLINE"
        val active = cm.activeNetwork ?: return "OFFLINE"
        val caps = cm.getNetworkCapabilities(active) ?: return "OFFLINE"
        if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return "OFFLINE"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
            else -> "ONLINE"
        }
    }

    fun release() {
        try {
            connectivityManager?.unregisterNetworkCallback(networkCallback)
        } catch (_: Exception) {
            // ignore if already unregistered or never registered
        }
    }
}
