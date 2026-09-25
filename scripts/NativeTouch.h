#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// Only linked into the generated UI-test runner, never the shipped app.
NS_ASSUME_NONNULL_BEGIN
@interface NativeTouch : NSObject
+ (BOOL)tapPoints:(NSArray<NSValue *> *)points error:(NSError **)error;
@end
NS_ASSUME_NONNULL_END
