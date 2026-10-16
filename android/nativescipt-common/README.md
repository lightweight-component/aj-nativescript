# aj-nativescript Java library

This is the common Java library project. Open the `android/nativescipt-common` directory directly from Android Studio.

The NativeScript npm package is maintained separately in `nativescript-plugin/nativescipt-common`. Its `npm pack` and `npm publish` lifecycle builds this Gradle project and includes the runtime JAR automatically.

The sibling projects `android/nativescipt-mqtt-v3` and `android/nativescipt-mqtt-v5` provide independent MQTT libraries.

## Build

From this directory, run:

```powershell
.\gradlew.bat :aj-nativescript:test :aj-nativescript:jar
```

The resulting artifact is written to:

```text
aj-nativescript/build/libs/aj-nativescript-1.0.0-SNAPSHOT.jar
```

The library's Java package is `com.ajaxjs.nativescript.android`.

## Host network permissions

This JAR cannot merge a manifest into the host app. Declare the following permissions
in the host's `AndroidManifest.xml`, as direct children of `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

`INTERNET` is required for HTTP/MQTT connections and DNS lookup.
`ACCESS_NETWORK_STATE` is required by `Helper.isInternetAvailable(context)`.
Both are normal permissions and do not require a runtime permission dialog.
The demo app already declares both permissions in
`demo-app/App_Resources/Android/src/main/AndroidManifest.xml`.

If network-state access is denied, `isInternetAvailable` logs the permission problem
and returns `false`. Its result reflects Android's validated default network,
not whether a particular server is reachable.

## POST custom headers

The existing five-argument `HttpRequest.post` remains unchanged. The six-argument overload accepts a header callback before `onError`:

```java
HttpRequest.post(url, jsonBody, response -> handleResponse(response), null,
        connection -> {
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("X-Device-Id", deviceId);
        },
        error -> handleError(error));
```

The header callback runs on the background request thread before sending the body or receiving the response. It can override the default `Content-Type` and also runs for requests without a body. Pass `null` to omit custom headers. Do not connect or read/write the connection inside this callback. Exceptions are delivered to `onError`.

## Synchronous HTTP

Use `HttpRequest.getSync(url)` or `HttpRequest.postSync(url, body)` only on a background thread. Both also accept a header callback, or a `Network` followed by a header callback. Existing asynchronous APIs remain available and share the same request implementation.

```java
String response = HttpRequest.postSync(url, jsonBody, connection -> {
    connection.setRequestProperty("Authorization", "Bearer " + token);
});
```

The methods block the calling thread, return UTF-8 response text trimmed at both ends for HTTP 2xx, and return an empty string for an empty response. Non-2xx responses and network failures throw `IOException`; header callback exceptions propagate unchanged. Calling from Android's main thread throws `IllegalStateException` before starting the request. Connections are released before returning or throwing. GET keeps 5s connect/10s read timeouts; POST keeps 55s connect/50s read timeouts.
