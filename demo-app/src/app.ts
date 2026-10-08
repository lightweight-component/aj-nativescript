import { createApp, registerElement } from "nativescript-vue";
import { ImageCacheIt } from "@triniwiz/nativescript-image-cache-it";
import { initGlobals } from "./globals";
initGlobals();

import Home from "./components/Home.vue";

registerElement("ImageCacheIt", () => ImageCacheIt);
createApp(Home).start();
