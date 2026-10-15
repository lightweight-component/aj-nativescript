#import <XCTest/XCTest.h>

/**
 * 实际操作已安装的 NativeScript demo，测试包本身不提供业务 App。
 */
@interface ConfirmUITests : XCTestCase
@property(nonatomic, strong) XCUIApplication *app;
@end

@implementation ConfirmUITests

- (void)setUp {
    [super setUp];
    self.continueAfterFailure = NO;
    self.app = [[XCUIApplication alloc] initWithBundleIdentifier:@"org.nativescript.nsvuevitedemo"];
    self.app.launchArguments = @[@"-confirmAutoCheck", @"YES"];
    [self.app launch];
    XCTAssertTrue([self.app.buttons[@"默认 Confirm"] waitForExistenceWithTimeout:15]);
}

/**
 * 等待页面实际显示回调状态，确认 Promise 和 await 后的代码都已经执行。
 */
- (void)waitText:(NSString *)text {
    XCUIElement *element = [self.app.staticTexts matchingPredicate:[NSPredicate predicateWithFormat:@"label CONTAINS %@", text]].firstMatch;
    XCTAssertTrue([element waitForExistenceWithTimeout:8], @"Missing UI text: %@", text);
}

- (void)testConfirmAndCancel {
    [self.app.buttons[@"默认 Confirm"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-ok"] waitForExistenceWithTimeout:5]);
    [self.app.buttons[@"ajaxjs-confirm-ok"] tap];
    [self waitText:@"默认:RESULT:true:AFTER:1"];
    [self.app.buttons[@"默认 Confirm"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-cancel"] waitForExistenceWithTimeout:5]);
    [self.app.buttons[@"ajaxjs-confirm-cancel"] tap];
    [self waitText:@"默认:RESULT:false:AFTER:2"];
    [self waitText:@"完成回调 2 | await 后代码 2"];
}

- (void)testMaskPolicy {
    [self.app.buttons[@"蒙层可关闭"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-cancel"] waitForExistenceWithTimeout:5]);
    XCUICoordinate *mask = [self.app coordinateWithNormalizedOffset:CGVectorMake(0.03, 0.2)];
    [mask tap];
    [self waitText:@"蒙层可关闭:RESULT:false:AFTER:1"];
    [self.app.buttons[@"蒙层不可关闭"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-cancel"] waitForExistenceWithTimeout:5]);
    [mask tap];
    XCTAssertTrue(self.app.buttons[@"ajaxjs-confirm-cancel"].exists);
    [self.app.buttons[@"ajaxjs-confirm-cancel"] tap];
    [self waitText:@"蒙层不可关闭:RESULT:false:AFTER:2"];
}

- (void)testStylesAndLongContent {
    [self.app.buttons[@"自定义配色与文案"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-ok"] waitForExistenceWithTimeout:5]);
    XCTAssertEqualObjects(self.app.buttons[@"ajaxjs-confirm-ok"].label, @"继续");
    XCTAssertEqualObjects(self.app.buttons[@"ajaxjs-confirm-cancel"].label, @"返回");
    [self waitText:@"第二行 🤖"];
    XCTAttachment *attachment = [XCTAttachment attachmentWithScreenshot:self.app.screenshot];
    attachment.name = @"iOS custom Confirm";
    attachment.lifetime = XCTAttachmentLifetimeKeepAlways;
    [self addAttachment:attachment];
    [self.app.buttons[@"ajaxjs-confirm-ok"] tap];
    [self waitText:@"自定义:RESULT:true:AFTER:1"];
    [self.app.buttons[@"长正文（可滚动）"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-ok"] waitForExistenceWithTimeout:5]);
    XCTAssertTrue(self.app.buttons[@"ajaxjs-confirm-ok"].hittable);
    XCTAssertTrue(self.app.buttons[@"ajaxjs-confirm-cancel"].hittable);
    [self.app.buttons[@"ajaxjs-confirm-ok"] tap];
    [self waitText:@"长正文:RESULT:true:AFTER:2"];
}

- (void)testQueueAndErrorRecovery {
    [self.app.buttons[@"连续两个弹窗"] tap];
    [self waitText:@"队列 1"];
    [self.app.buttons[@"ajaxjs-confirm-cancel"] tap];
    [self waitText:@"队列 2"];
    [self.app.buttons[@"ajaxjs-confirm-ok"] tap];
    [self waitText:@"队列:RESULT:false,true:AFTER:1"];
    [self waitText:@"完成回调 2 | await 后代码 1"];
    [self.app.buttons[@"无效配色错误"] tap];
    [self waitText:@"错误:ERROR:"];
    [self waitText:@"完成回调 2 | await 后代码 1"];
    [self.app.buttons[@"默认 Confirm"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-ok"] waitForExistenceWithTimeout:5]);
    [self.app.buttons[@"ajaxjs-confirm-ok"] tap];
    [self waitText:@"默认:RESULT:true:AFTER:2"];
}

- (void)testBackgroundCancelsOnce {
    [self.app.buttons[@"默认 Confirm"] tap];
    XCTAssertTrue([self.app.buttons[@"ajaxjs-confirm-ok"] waitForExistenceWithTimeout:5]);
    [[XCUIDevice sharedDevice] pressButton:XCUIDeviceButtonHome];
    [self.app activate];
    [self waitText:@"默认:RESULT:false:AFTER:1"];
    [self waitText:@"完成回调 1 | await 后代码 1"];
    XCTAssertFalse(self.app.buttons[@"ajaxjs-confirm-ok"].exists);
}

@end
