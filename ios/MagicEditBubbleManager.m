#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(MagicEditBubbleManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(active, BOOL)
RCT_EXPORT_VIEW_PROPERTY(checking, BOOL)
RCT_EXPORT_VIEW_PROPERTY(dragging, BOOL)
RCT_EXPORT_VIEW_PROPERTY(pressed, BOOL)
RCT_EXPORT_VIEW_PROPERTY(bottomInset, double)
RCT_EXPORT_VIEW_PROPERTY(overlayAccessibilityLabel, NSString)
RCT_EXPORT_VIEW_PROPERTY(overlayAccessibilityValue, NSString)
RCT_EXPORT_VIEW_PROPERTY(onNativeTap, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onNativeDragEnd, RCTDirectEventBlock)

@end

@interface RCT_EXTERN_MODULE(MagicEditSelectorModule, NSObject)

RCT_EXTERN_METHOD(appMetadata:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(backgroundUpdatesStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setBackgroundUpdatesEnabled:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(select:(NSArray *)targetThreads
                  selectedThreadId:(NSString *)selectedThreadId
                  linkTarget:(NSString *)linkTarget
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(composeComment:(NSDictionary *)selection
                  targetThreads:(NSArray *)targetThreads
                  selectedThreadId:(NSString *)selectedThreadId
                  linkTarget:(NSString *)linkTarget
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancel)

@end
