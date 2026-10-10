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
