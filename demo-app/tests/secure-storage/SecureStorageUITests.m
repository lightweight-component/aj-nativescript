#import <XCTest/XCTest.h>

/**
 * 操作现有 NativeScript demo，跨进程重启验证真实 Keychain 持久化与清理。
 */
@interface SecureStorageUITests : XCTestCase
@end

@implementation SecureStorageUITests

- (void)waitText:(NSString *)text app:(XCUIApplication *)app {
    XCUIElement *element = [app.staticTexts matchingPredicate:[NSPredicate predicateWithFormat:@"label CONTAINS %@", text]].firstMatch;
    XCTAssertTrue([element waitForExistenceWithTimeout:15], @"Missing UI state: %@", text);
}

- (void)testSelfCheckAndRestartPersistence {
    self.continueAfterFailure = NO;
    XCUIApplication *app = [[XCUIApplication alloc] initWithBundleIdentifier:@"org.nativescript.nsvuevitedemo"];
    app.launchArguments = @[@"-secureStorageAutoCheck", @"YES"];
    [app launch];
    XCTAssertTrue([app.buttons[@"运行安全存储自检"] waitForExistenceWithTimeout:15]);
    [app.buttons[@"运行安全存储自检"] tap];
    [self waitText:@"SECURE_STORAGE_SELF_CHECK:PASS" app:app];
    [app.buttons[@"写入重启测试数据"] tap];
    [self waitText:@"SECURE_STORAGE_RESTART:READY" app:app];
    [app terminate];
    [app launch];
    XCTAssertTrue([app.buttons[@"验证重启后数据并清理"] waitForExistenceWithTimeout:15]);
    [app.buttons[@"验证重启后数据并清理"] tap];
    [self waitText:@"SECURE_STORAGE_RESTART:PASS:CLEANED" app:app];
    [app.buttons[@"运行安全存储自检"] tap];
    [self waitText:@"SECURE_STORAGE_SELF_CHECK:PASS" app:app];
    XCTAttachment *attachment = [XCTAttachment attachmentWithScreenshot:app.screenshot];
    attachment.name = @"iOS secure storage self check";
    attachment.lifetime = XCTAttachmentLifetimeKeepAlways;
    [self addAttachment:attachment];
}

@end
