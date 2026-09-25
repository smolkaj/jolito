#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// Only linked into the generated UI-test runner, never the shipped app.
NS_ASSUME_NONNULL_BEGIN
@interface NativeTouch : NSObject
+ (void)tapPoints:(NSArray<NSValue *> *)points completion:(void (^)(NSError * _Nullable))completion;
@end
NS_ASSUME_NONNULL_END
