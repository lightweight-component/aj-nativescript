package com.ajaxjs.nativescript;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class AjNativescriptTest {
    @Test
    void exposesLibraryName() {
        assertEquals("aj-nativescript", AjNativescript.getName());
    }
}
