import React
import SwiftUI
import UIKit
import WebKit

private final class MagicEditBubbleModel: ObservableObject {
  @Published var active = false
  @Published var checking = false
  @Published var dragging = false
  @Published var pressed = false
}

private struct MagicEditBubble: View {
  @ObservedObject var model: MagicEditBubbleModel
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    ZStack {
      bubbleBackground
      Circle()
        .stroke(
          AngularGradient(
            colors: [.blue.opacity(0.72), .purple, .pink.opacity(0.78), .blue.opacity(0.72)],
            center: .center
          ),
          lineWidth: model.active ? 2.5 : 1.5
        )
        .padding(1)
      Circle()
        .fill(.white.opacity(0.72))
        .frame(width: 5, height: 5)
        .offset(x: -14, y: -15)
      Circle()
        .fill(.pink.opacity(0.82))
        .frame(width: 4, height: 4)
        .offset(x: 17, y: 13)

      if model.checking {
        ProgressView()
          .controlSize(.small)
          .tint(.purple)
      } else {
        Image(systemName: model.active ? "xmark" : "wand.and.stars")
          .symbolRenderingMode(.palette)
          .foregroundStyle(model.active ? Color.primary : Color.purple, Color.pink)
          .font(.system(size: model.active ? 18 : 20, weight: .semibold))
      }
    }
    .frame(width: 54, height: 54)
    .contentShape(Circle())
    .scaleEffect(model.dragging && !reduceMotion ? 1.08 : model.pressed && !reduceMotion ? 0.88 : 1)
    .rotationEffect(.degrees(model.dragging && !reduceMotion ? 4 : model.pressed && !reduceMotion ? -7 : 0))
    .animation(
      reduceMotion ? nil : .spring(response: 0.28, dampingFraction: 0.62),
      value: model.dragging || model.pressed
    )
    .shadow(color: .purple.opacity(model.active ? 0.34 : 0.2), radius: model.active ? 13 : 8, y: 4)
    .accessibilityHidden(true)
  }

  @ViewBuilder private var bubbleBackground: some View {
    let shape = Circle()
    if #available(iOS 26.0, *) {
      shape.glassEffect(.regular, in: shape)
    } else {
      shape.fill(.ultraThinMaterial)
    }
  }
}

private final class MagicEditBubbleOverlayContainer: UIView {
  var onAccessibilityActivate: (() -> Void)?

  override func accessibilityActivate() -> Bool {
    onAccessibilityActivate?()
    return true
  }
}

private final class MagicEditBubbleOverlayWindow: UIWindow {
  weak var bubbleContainer: UIView?
  override var canBecomeKey: Bool { false }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard
      let bubbleContainer,
      !bubbleContainer.isHidden,
      bubbleContainer.alpha > 0.01,
      bubbleContainer.point(inside: bubbleContainer.convert(point, from: self), with: event)
    else { return nil }
    return super.hitTest(point, with: event)
  }
}

private final class MagicEditBubbleOverlayCoordinator: NSObject {
  static let shared = MagicEditBubbleOverlayCoordinator()
  private static let shadowPadding: CGFloat = 20

  private weak var hostView: MagicEditBubbleHostView?
  private var overlayWindow: MagicEditBubbleOverlayWindow?
  private var overlayController: UIViewController?
  private var bubbleContainer: MagicEditBubbleOverlayContainer?
  private var hostingController: UIHostingController<MagicEditBubble>?
  private var bubbleOrigin = CGPoint.zero
  private var dragOrigin: CGPoint?

  func attach(_ hostView: MagicEditBubbleHostView) {
    ensureOverlay(for: hostView)
    self.hostView = hostView
    updateFrame(for: hostView)
    updateAccessibility(for: hostView)
  }

  func detach(_ hostView: MagicEditBubbleHostView) {
    guard self.hostView === hostView else { return }
    tearDownOverlay()
  }

  func updateFrame(for hostView: MagicEditBubbleHostView) {
    guard
      self.hostView === hostView,
      let sourceWindow = hostView.window,
      let bubbleContainer
    else { return }
    guard dragOrigin == nil else { return }
    let sourceRect = hostView.convert(hostView.bounds, to: sourceWindow)
    bubbleOrigin = sourceRect.origin
    positionOverlay(at: sourceRect.origin, size: sourceRect.size, sourceWindow: sourceWindow)
    bubbleContainer.isHidden = hostView.isHidden || hostView.alpha <= 0.01 || hostView.bounds.isEmpty
  }

  func updateAccessibility(for hostView: MagicEditBubbleHostView) {
    guard self.hostView === hostView, let bubbleContainer else { return }
    bubbleContainer.accessibilityLabel = hostView.overlayAccessibilityLabel
    bubbleContainer.accessibilityValue = hostView.overlayAccessibilityValue
    bubbleContainer.accessibilityTraits = hostView.checking ? [.button, .notEnabled] : .button
  }

  private func ensureOverlay(for hostView: MagicEditBubbleHostView) {
    guard let windowScene = hostView.window?.windowScene else { return }
    if overlayWindow?.windowScene === windowScene, hostingController?.rootView.model === hostView.model {
      return
    }
    tearDownOverlay()

    let controller = UIViewController()
    controller.view.backgroundColor = .clear
    controller.view.isOpaque = false
    controller.view.clipsToBounds = false

    let window = MagicEditBubbleOverlayWindow(windowScene: windowScene)
    window.frame = .zero
    window.backgroundColor = .clear
    window.isOpaque = false
    window.clipsToBounds = false
    window.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
    window.rootViewController = controller

    let container = MagicEditBubbleOverlayContainer()
    container.backgroundColor = .clear
    container.isAccessibilityElement = true
    container.accessibilityIdentifier = "magic_edit_drag_handle"
    container.accessibilityTraits = .button
    controller.view.addSubview(container)

    let hosting = UIHostingController(rootView: MagicEditBubble(model: hostView.model))
    hosting.view.backgroundColor = .clear
    hosting.view.isOpaque = false
    hosting.view.isUserInteractionEnabled = false
    hosting.view.accessibilityElementsHidden = true
    hosting.view.translatesAutoresizingMaskIntoConstraints = false
    controller.addChild(hosting)
    container.addSubview(hosting.view)
    NSLayoutConstraint.activate([
      hosting.view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
      hosting.view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
      hosting.view.topAnchor.constraint(equalTo: container.topAnchor),
      hosting.view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
    ])
    hosting.didMove(toParent: controller)

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
    let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    tap.require(toFail: pan)
    container.addGestureRecognizer(tap)
    container.addGestureRecognizer(pan)
    container.onAccessibilityActivate = { [weak self] in self?.performTap() }

    window.bubbleContainer = container
    overlayController = controller
    overlayWindow = window
    bubbleContainer = container
    hostingController = hosting
    window.isHidden = false
  }

  private func tearDownOverlay() {
    hostingController?.willMove(toParent: nil)
    hostingController?.view.removeFromSuperview()
    hostingController?.removeFromParent()
    bubbleContainer?.removeFromSuperview()
    overlayWindow?.isHidden = true
    overlayWindow?.rootViewController = nil
    hostView = nil
    overlayWindow = nil
    overlayController = nil
    bubbleContainer = nil
    hostingController = nil
    bubbleOrigin = .zero
    dragOrigin = nil
  }

  private func positionOverlay(at origin: CGPoint, size: CGSize, sourceWindow: UIWindow) {
    guard let overlayWindow, let bubbleContainer else { return }
    let bubbleRect = CGRect(origin: origin, size: size)
    let screenRect = sourceWindow.convert(bubbleRect, to: nil)
    let padding = Self.shadowPadding
    overlayWindow.frame = screenRect.insetBy(dx: -padding, dy: -padding)
    bubbleContainer.frame = CGRect(
      x: padding,
      y: padding,
      width: screenRect.width,
      height: screenRect.height
    )
    bubbleOrigin = origin
  }

  @objc private func handleTap() {
    performTap()
  }

  private func performTap() {
    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    hostView?.emitNativeTap()
  }

  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    guard
      let hostView,
      let sourceWindow = hostView.window,
      let bubbleContainer
    else { return }
    switch gesture.state {
    case .began:
      dragOrigin = bubbleOrigin
      hostView.setNativeDragging(true)
      UISelectionFeedbackGenerator().selectionChanged()
    case .changed:
      guard let dragOrigin else { return }
      let translation = gesture.translation(in: sourceWindow)
      let maximumX = max(8, sourceWindow.bounds.width - bubbleContainer.bounds.width - 8)
      let maximumY = max(
        8,
        sourceWindow.bounds.height - bubbleContainer.bounds.height - CGFloat(hostView.bottomInset)
      )
      positionOverlay(
        at: CGPoint(
          x: min(maximumX, max(8, dragOrigin.x + translation.x)),
          y: min(maximumY, max(8, dragOrigin.y + translation.y))
        ),
        size: bubbleContainer.bounds.size,
        sourceWindow: sourceWindow
      )
    case .ended, .cancelled, .failed:
      dragOrigin = nil
      hostView.setNativeDragging(false)
      hostView.emitNativeDragEnd(at: bubbleOrigin)
    default:
      break
    }
  }
}

@objc(MagicEditBubbleView)
final class MagicEditBubbleHostView: UIView {
  fileprivate let model = MagicEditBubbleModel()

  @objc var active = false {
    didSet {
      model.active = active
      MagicEditBubbleOverlayCoordinator.shared.updateAccessibility(for: self)
    }
  }
  @objc var checking = false {
    didSet {
      model.checking = checking
      MagicEditBubbleOverlayCoordinator.shared.updateAccessibility(for: self)
    }
  }
  @objc var dragging = false {
    didSet {
      model.dragging = dragging
      if dragging && !oldValue {
        UISelectionFeedbackGenerator().selectionChanged()
      }
    }
  }
  @objc var pressed = false {
    didSet {
      model.pressed = pressed
      if pressed && !oldValue {
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
      }
    }
  }
  @objc var bottomInset = 8.0
  @objc var overlayAccessibilityLabel: String = "Magic Edit" {
    didSet { MagicEditBubbleOverlayCoordinator.shared.updateAccessibility(for: self) }
  }
  @objc var overlayAccessibilityValue: String = "idle" {
    didSet { MagicEditBubbleOverlayCoordinator.shared.updateAccessibility(for: self) }
  }
  @objc var onNativeTap: RCTDirectEventBlock?
  @objc var onNativeDragEnd: RCTDirectEventBlock?

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    accessibilityIdentifier = "native_magic_edit_bubble_host"
    accessibilityElementsHidden = true
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else {
      MagicEditBubbleOverlayCoordinator.shared.detach(self)
      return
    }
    MagicEditBubbleOverlayCoordinator.shared.attach(self)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    MagicEditBubbleOverlayCoordinator.shared.updateFrame(for: self)
  }

  fileprivate func emitNativeTap() {
    onNativeTap?([:])
  }

  fileprivate func emitNativeDragEnd(at point: CGPoint) {
    onNativeDragEnd?(["x": point.x, "y": point.y])
  }

  fileprivate func setNativeDragging(_ dragging: Bool) {
    model.dragging = dragging
  }
}

private func magicEditThreadDeepLink(_ targetThread: [String: Any]) -> URL? {
  guard
    let rawID = targetThread["id"] as? String,
    UUID(uuidString: rawID.trimmingCharacters(in: .whitespacesAndNewlines)) != nil
  else { return nil }
  var components = URLComponents()
  components.scheme = "acpweb"
  components.host = "open"
  components.queryItems = [
    URLQueryItem(
      name: "path",
      value: "/threads/\(rawID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
    )
  ]
  return components.url
}

private enum MagicEditThreadLinkTarget: String {
  case app
  case web
}

private func magicEditThreadURL(
  _ targetThread: [String: Any],
  linkTarget: MagicEditThreadLinkTarget
) -> URL? {
  if linkTarget == .web {
    guard
      let rawURL = targetThread["url"] as? String,
      let components = URLComponents(
        string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
      ),
      components.scheme?.lowercased() == "https",
      components.host?.isEmpty == false
    else { return nil }
    return components.url
  }
  return magicEditThreadDeepLink(targetThread)
}

private func openMagicEditThread(
  _ targetThread: [String: Any],
  linkTarget: MagicEditThreadLinkTarget
) {
  guard let url = magicEditThreadURL(targetThread, linkTarget: linkTarget) else { return }
  UIApplication.shared.open(url)
}

private final class MagicEditSelectionOverlay: UIView {
  private enum DockPlacement {
    case bottom
    case avoidingCursor
  }

  private static let dockHeight: CGFloat = 80
  private static let dockEdgeInset: CGFloat = 9
  private static let dockBottomSpacing: CGFloat = 10
  private static let dockAvoidanceSpacing: CGFloat = 14
  private static let dockEntryPadding: CGFloat = 10
  private static let dockExitPadding: CGFloat = 34

  private let targetThreads: [[String: Any]]
  private var selectedThreadIndex: Int
  private let threadLinkTarget: MagicEditThreadLinkTarget
  private weak var inspectedWindow: UIWindow?
  private let highlightLayer = CAShapeLayer()
  private let targetLabel = UILabel()
  private let threadDestinationView = UIVisualEffectView(
    effect: UIBlurEffect(style: .systemChromeMaterialDark)
  )
  private let threadDestinationButton = UIButton(type: .system)
  private let threadSwitcherButton = UIButton(type: .system)
  private let cursorView = UIView(frame: CGRect(x: 0, y: 0, width: 28, height: 32))
  private let cursorLayer = CAShapeLayer()
  private let dockView = UIView()
  private let instructionLabel = UILabel()
  private let dockTargetLabel = UILabel()
  private let dockDetailsLabel = UILabel()
  private let selectButton = UIButton(type: .system)
  private var targetView: UIView?
  private var selectedDescriptor: [String: Any]?
  private var cursorPoint: CGPoint?
  private var dragTouchOrigin: CGPoint?
  private var dragCursorOrigin: CGPoint?
  private var dockPlacement = DockPlacement.bottom
  private var webInspectionGeneration = 0
  private var webInspectionInFlight = false
  private var pendingWebInspection: (webView: WKWebView, point: CGPoint, generation: Int)?
  private weak var currentWebView: WKWebView?
  var onComplete: (([String: Any]?) -> Void)?

  init(
    window: UIWindow,
    targetThreads: [[String: Any]],
    selectedThreadId: String,
    threadLinkTarget: String
  ) {
    let recipients = targetThreads.isEmpty ? [[:]] : targetThreads
    self.targetThreads = recipients
    self.selectedThreadIndex = recipients.firstIndex {
      Self.dictionaryString($0, key: "id", fallback: "") == selectedThreadId
    } ?? 0
    self.threadLinkTarget = MagicEditThreadLinkTarget(rawValue: threadLinkTarget) ?? .app
    inspectedWindow = window
    super.init(frame: window.bounds)
    autoresizingMask = [.flexibleWidth, .flexibleHeight]
    backgroundColor = .clear
    accessibilityViewIsModal = true

    highlightLayer.fillColor = UIColor.systemPurple.withAlphaComponent(0.12).cgColor
    highlightLayer.strokeColor = UIColor.systemPurple.cgColor
    highlightLayer.lineWidth = 2
    layer.addSublayer(highlightLayer)

    threadDestinationView.layer.borderColor = UIColor.systemPurple.withAlphaComponent(0.42).cgColor
    threadDestinationView.layer.borderWidth = 1
    threadDestinationView.layer.cornerCurve = .continuous
    threadDestinationView.layer.cornerRadius = 17
    threadDestinationView.layer.masksToBounds = true
    addSubview(threadDestinationView)

    threadDestinationButton.titleLabel?.lineBreakMode = .byTruncatingTail
    threadDestinationButton.accessibilityIdentifier = "magic_edit_selector_target_thread"
    threadDestinationButton.addTarget(self, action: #selector(openTargetThread), for: .touchUpInside)
    threadDestinationView.contentView.addSubview(threadDestinationButton)

    threadSwitcherButton.setImage(
      UIImage(systemName: "chevron.up.chevron.down", withConfiguration: UIImage.SymbolConfiguration(pointSize: 10, weight: .bold)),
      for: .normal
    )
    threadSwitcherButton.tintColor = UIColor(red: 183 / 255, green: 169 / 255, blue: 1, alpha: 1)
    threadSwitcherButton.accessibilityLabel = "Switch recipient thread"
    threadSwitcherButton.accessibilityHint = "Selects the next recipient. Touch and hold to choose a specific thread."
    threadSwitcherButton.accessibilityIdentifier = "magic_edit_selector_thread_switcher"
    threadSwitcherButton.showsMenuAsPrimaryAction = false
    threadSwitcherButton.addTarget(
      self,
      action: #selector(selectNextRecipient),
      for: .touchUpInside
    )
    threadDestinationView.contentView.addSubview(threadSwitcherButton)
    configureThreadDestination(animated: false)

    targetLabel.font = .systemFont(ofSize: 11, weight: .semibold)
    targetLabel.textColor = .white
    targetLabel.backgroundColor = UIColor.systemPurple.withAlphaComponent(0.94)
    targetLabel.layer.cornerRadius = 6
    targetLabel.layer.masksToBounds = true
    targetLabel.textAlignment = .center
    targetLabel.isUserInteractionEnabled = false
    targetLabel.isHidden = true
    addSubview(targetLabel)

    cursorLayer.fillColor = UIColor.white.cgColor
    cursorLayer.strokeColor = UIColor.black.withAlphaComponent(0.92).cgColor
    cursorLayer.lineWidth = 1
    cursorLayer.lineJoin = .round
    let cursorPath = UIBezierPath()
    cursorPath.move(to: CGPoint(x: 0, y: 0))
    cursorPath.addLine(to: CGPoint(x: 19.4, y: 18.6))
    cursorPath.addLine(to: CGPoint(x: 12.1, y: 19.4))
    cursorPath.addLine(to: CGPoint(x: 16.1, y: 25.9))
    cursorPath.addLine(to: CGPoint(x: 12.8, y: 27))
    cursorPath.addLine(to: CGPoint(x: 8.8, y: 20.8))
    cursorPath.addLine(to: CGPoint(x: 0, y: 27))
    cursorPath.close()
    cursorLayer.path = cursorPath.cgPath
    cursorView.layer.addSublayer(cursorLayer)
    cursorView.layer.shadowColor = UIColor.black.cgColor
    cursorView.layer.shadowOpacity = 0.95
    cursorView.layer.shadowOffset = CGSize(width: 0, height: 2)
    cursorView.layer.shadowRadius = 3
    cursorView.isUserInteractionEnabled = false
    cursorView.accessibilityElementsHidden = true

    dockView.backgroundColor = UIColor(red: 34 / 255, green: 32 / 255, blue: 41 / 255, alpha: 0.98)
    dockView.layer.borderColor = UIColor(red: 87 / 255, green: 80 / 255, blue: 105 / 255, alpha: 1).cgColor
    dockView.layer.borderWidth = 1
    dockView.layer.cornerRadius = 12
    dockView.layer.shadowColor = UIColor.black.cgColor
    dockView.layer.shadowOpacity = 0.48
    dockView.layer.shadowOffset = CGSize(width: 0, height: 12)
    dockView.layer.shadowRadius = 18
    addSubview(dockView)

    instructionLabel.text = "DRAG ANYWHERE TO AIM"
    instructionLabel.font = .systemFont(ofSize: 8, weight: .bold)
    instructionLabel.textColor = UIColor(red: 140 / 255, green: 135 / 255, blue: 154 / 255, alpha: 1)
    instructionLabel.accessibilityIdentifier = "magic_edit_selector_instruction"
    dockView.addSubview(instructionLabel)

    dockTargetLabel.text = "Move the cursor over an element"
    dockTargetLabel.font = .systemFont(ofSize: 11, weight: .semibold)
    dockTargetLabel.textColor = UIColor(red: 229 / 255, green: 224 / 255, blue: 241 / 255, alpha: 1)
    dockTargetLabel.lineBreakMode = .byTruncatingTail
    dockTargetLabel.accessibilityIdentifier = "magic_edit_selector_target_label"
    dockView.addSubview(dockTargetLabel)

    dockDetailsLabel.font = .monospacedSystemFont(ofSize: 8.5, weight: .regular)
    dockDetailsLabel.textColor = UIColor(red: 164 / 255, green: 157 / 255, blue: 180 / 255, alpha: 1)
    dockDetailsLabel.numberOfLines = 2
    dockDetailsLabel.lineBreakMode = .byTruncatingTail
    dockDetailsLabel.accessibilityIdentifier = "magic_edit_selector_target_details"
    dockView.addSubview(dockDetailsLabel)

    selectButton.setTitle("✓  Select", for: .normal)
    selectButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .heavy)
    selectButton.setTitleColor(.white, for: .normal)
    selectButton.setTitleColor(UIColor.white.withAlphaComponent(0.45), for: .disabled)
    selectButton.backgroundColor = UIColor(red: 118 / 255, green: 102 / 255, blue: 223 / 255, alpha: 1)
    selectButton.layer.cornerRadius = 8
    selectButton.isEnabled = false
    selectButton.alpha = 0.4
    selectButton.accessibilityIdentifier = "magic_edit_selector_select"
    selectButton.addTarget(self, action: #selector(selectTarget), for: .touchUpInside)
    dockView.addSubview(selectButton)

    addSubview(cursorView)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  private static func dictionaryString(
    _ dictionary: [String: Any],
    key: String,
    fallback: String
  ) -> String {
    guard let raw = dictionary[key] as? String else { return fallback }
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? fallback : String(value.prefix(500))
  }

  private var targetThread: [String: Any] {
    targetThreads[selectedThreadIndex]
  }

  private func configureThreadDestination(animated: Bool) {
    let threadTitle = Self.dictionaryString(
      targetThread,
      key: "title",
      fallback: "ACP thread \(Self.dictionaryString(targetThread, key: "id", fallback: "").prefix(8))"
    )
    let destinationText = "Sending to “\(threadTitle)”"
    let attributedDestination = NSMutableAttributedString(
      string: destinationText,
      attributes: [
        .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
        .foregroundColor: UIColor(red: 185 / 255, green: 180 / 255, blue: 199 / 255, alpha: 1),
      ]
    )
    attributedDestination.addAttribute(
      .foregroundColor,
      value: UIColor(red: 183 / 255, green: 169 / 255, blue: 1, alpha: 1),
      range: (destinationText as NSString).range(of: threadTitle)
    )
    let update = {
      self.threadDestinationButton.setAttributedTitle(attributedDestination, for: .normal)
    }
    if animated && !UIAccessibility.isReduceMotionEnabled {
      UIView.transition(
        with: threadDestinationButton,
        duration: 0.24,
        options: [.transitionCrossDissolve, .allowAnimatedContent],
        animations: update
      )
    } else {
      update()
    }
    threadDestinationButton.accessibilityLabel = destinationText
    threadDestinationButton.accessibilityValue = Self.dictionaryString(
      targetThread,
      key: "id",
      fallback: "Unknown thread"
    )
    threadDestinationButton.accessibilityHint = threadLinkTarget == .web
      ? "Opens this thread in ACP Web"
      : "Opens this thread in the ACP Web app"
    threadSwitcherButton.isHidden = targetThreads.count < 2
    threadSwitcherButton.menu = targetThreads.count > 1
      ? UIMenu(
        title: "Send comment to",
        children: targetThreads.enumerated().map { index, thread in
          let title = Self.dictionaryString(
            thread,
            key: "title",
            fallback: "ACP thread \(Self.dictionaryString(thread, key: "id", fallback: "").prefix(8))"
          )
          return UIAction(
            title: "Send to \(title)",
            state: index == selectedThreadIndex ? .on : .off
          ) { [weak self] _ in
            self?.selectRecipient(at: index)
          }
        }
      )
      : nil
    threadSwitcherButton.accessibilityValue = threadTitle
    setNeedsLayout()
  }

  private func selectRecipient(at index: Int) {
    guard targetThreads.indices.contains(index), index != selectedThreadIndex else { return }
    selectedThreadIndex = index
    UISelectionFeedbackGenerator().selectionChanged()
    configureThreadDestination(animated: true)
  }

  @objc private func selectNextRecipient() {
    guard targetThreads.count > 1 else { return }
    selectRecipient(at: (selectedThreadIndex + 1) % targetThreads.count)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let safeTop = safeAreaInsets.top
    let maximumDestinationWidth = max(120, bounds.width - 20)
    let switcherWidth: CGFloat = targetThreads.count > 1 ? 34 : 0
    let destinationWidth = min(
      maximumDestinationWidth,
      ceil(threadDestinationButton.titleLabel?.sizeThatFits(
        CGSize(width: maximumDestinationWidth - 22 - switcherWidth, height: 34)
      ).width ?? maximumDestinationWidth) + 22 + switcherWidth
    )
    threadDestinationView.frame = CGRect(
      x: (bounds.width - destinationWidth) / 2,
      y: safeTop + 10,
      width: destinationWidth,
      height: 34
    )
    threadDestinationButton.frame = CGRect(
      x: 0,
      y: 0,
      width: threadDestinationView.bounds.width - switcherWidth,
      height: threadDestinationView.bounds.height
    )
    threadSwitcherButton.frame = CGRect(
      x: threadDestinationView.bounds.width - switcherWidth,
      y: 0,
      width: switcherWidth,
      height: threadDestinationView.bounds.height
    )
    dockView.frame = dockFrame(for: dockPlacement)
    selectButton.frame = CGRect(x: dockView.bounds.width - 100, y: 19, width: 92, height: 42)
    instructionLabel.frame = CGRect(x: 12, y: 8, width: dockView.bounds.width - 116, height: 12)
    dockTargetLabel.frame = CGRect(x: 12, y: 21, width: dockView.bounds.width - 116, height: 18)
    dockDetailsLabel.frame = CGRect(x: 12, y: 41, width: dockView.bounds.width - 116, height: 31)

    if let cursorPoint {
      setCursor(cursorPoint)
    } else if bounds.width > 0 && bounds.height > 0 {
      setCursor(CGPoint(x: bounds.midX, y: bounds.height * 0.42))
    }
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    guard let touchPoint = touches.first?.location(in: self), let cursorPoint else { return }
    dragTouchOrigin = touchPoint
    dragCursorOrigin = cursorPoint
    UIView.animate(withDuration: 0.12) {
      self.cursorView.transform = CGAffineTransform(scaleX: 1.08, y: 1.08)
      self.cursorView.layer.shadowColor = UIColor.systemPurple.cgColor
      self.cursorView.layer.shadowRadius = 6
    }
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
    moveCursor(with: touches.first)
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
    moveCursor(with: touches.first)
    endCursorDrag()
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
    endCursorDrag()
  }

  @objc func cancel() {
    complete(nil)
  }

  @objc private func openTargetThread() {
    UISelectionFeedbackGenerator().selectionChanged()
    let destination = targetThread
    complete(nil)
    openMagicEditThread(destination, linkTarget: threadLinkTarget)
  }

  @objc private func selectTarget() {
    guard let targetView else { return }
    UISelectionFeedbackGenerator().selectionChanged()
    if ancestorWebView(from: targetView) != nil {
      guard let selectedDescriptor else { return }
      completeSelection(selectedDescriptor)
      return
    }
    completeSelection(descriptor(for: targetView))
  }

  private func completeSelection(_ descriptor: [String: Any]) {
    var result = descriptor
    result["recipientThreadId"] = Self.dictionaryString(
      targetThread,
      key: "id",
      fallback: ""
    )
    complete(result)
  }

  private func moveCursor(with touch: UITouch?) {
    guard
      let point = touch?.location(in: self),
      let touchOrigin = dragTouchOrigin,
      let cursorOrigin = dragCursorOrigin
    else { return }
    setCursor(CGPoint(
      x: cursorOrigin.x + point.x - touchOrigin.x,
      y: cursorOrigin.y + point.y - touchOrigin.y
    ))
  }

  private func endCursorDrag() {
    dragTouchOrigin = nil
    dragCursorOrigin = nil
    UIView.animate(withDuration: 0.12) {
      self.cursorView.transform = .identity
      self.cursorView.layer.shadowColor = UIColor.black.cgColor
      self.cursorView.layer.shadowRadius = 3
    }
  }

  private func setCursor(_ point: CGPoint) {
    let clamped = CGPoint(
      x: min(bounds.width - 22, max(5, point.x)),
      y: min(bounds.height - 28, max(5, point.y))
    )
    cursorPoint = clamped
    cursorView.center = CGPoint(x: clamped.x + 11, y: clamped.y + 13)
    updateDockPlacement(for: cursorView.frame)
    updateTarget(at: clamped)
  }

  private func dockFrame(for placement: DockPlacement) -> CGRect {
    let bottomY = bounds.height - safeAreaInsets.bottom - Self.dockHeight - Self.dockBottomSpacing
    let y: CGFloat
    switch placement {
    case .bottom:
      y = bottomY
    case .avoidingCursor:
      y = max(
        threadDestinationView.frame.maxY + Self.dockBottomSpacing,
        bottomY - Self.dockHeight - Self.dockAvoidanceSpacing
      )
    }
    return CGRect(
      x: Self.dockEdgeInset,
      y: y,
      width: bounds.width - (Self.dockEdgeInset * 2),
      height: Self.dockHeight
    )
  }

  private func updateDockPlacement(for cursorFrame: CGRect) {
    let restingFrame = dockFrame(for: .bottom)
    let nextPlacement: DockPlacement
    switch dockPlacement {
    case .bottom:
      let entryFrame = cursorFrame.insetBy(
        dx: -Self.dockEntryPadding,
        dy: -Self.dockEntryPadding
      )
      nextPlacement = entryFrame.intersects(restingFrame) ? .avoidingCursor : .bottom
    case .avoidingCursor:
      nextPlacement = cursorFrame.maxY < restingFrame.minY - Self.dockExitPadding
        ? .bottom
        : .avoidingCursor
    }
    guard nextPlacement != dockPlacement else { return }
    dockPlacement = nextPlacement
    let targetFrame = dockFrame(for: nextPlacement)
    if UIAccessibility.isReduceMotionEnabled {
      UIView.animate(
        withDuration: 0.2,
        delay: 0,
        options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut]
      ) {
        self.dockView.frame = targetFrame
      }
      return
    }
    UIView.animate(
      withDuration: 0.46,
      delay: 0,
      usingSpringWithDamping: 0.8,
      initialSpringVelocity: 0.45,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseInOut]
    ) {
      self.dockView.frame = targetFrame
    }
  }

  private func updateTarget(at point: CGPoint) {
    guard let window = inspectedWindow else {
      clearTarget()
      return
    }
    isUserInteractionEnabled = false
    let windowPoint = convert(point, to: window)
    let rawTarget = hitTestBelowMagicEdit(
      windowPoint,
      in: window
    )
    isUserInteractionEnabled = true

    if let rawTarget, let webView = ancestorWebView(from: rawTarget) {
      targetView = webView
      inspectWebTarget(in: webView, at: convert(point, to: webView))
      return
    }

    guard let target = identifiedNativeView(at: windowPoint, in: window)
      ?? selectableView(from: rawTarget, in: window) else {
      clearTarget()
      return
    }

    invalidateWebInspection()
    targetView = target
    let rect = target.convert(target.bounds, to: self).intersection(bounds)
    let label = displayLabel(for: target)
    showTarget(
      label: label,
      details: nativeHoverDetails(for: target),
      rect: rect,
      descriptor: descriptor(for: target)
    )
  }

  private func hitTestBelowMagicEdit(_ point: CGPoint, in window: UIWindow) -> UIView? {
    let dragHandle = descendantView(in: window, matching: ["magic_edit_drag_handle"])
    let interactionLayer = dragHandle?.superview
    let wasHidden = interactionLayer?.isHidden
    interactionLayer?.isHidden = true
    defer {
      if let wasHidden { interactionLayer?.isHidden = wasHidden }
    }
    return window.hitTest(point, with: nil)
  }

  private func identifiedNativeView(at point: CGPoint, in window: UIWindow) -> UIView? {
    var bestView: UIView?
    var bestArea = CGFloat.greatestFiniteMagnitude
    var bestDepth = -1

    func inspect(_ view: UIView, depth: Int) {
      guard view !== self, !view.isHidden, view.alpha > 0.01 else { return }
      let localPoint = view.convert(point, from: window)
      guard view.bounds.contains(localPoint) else { return }
      if view is WKWebView { return }

      for child in view.subviews.reversed() {
        inspect(child, depth: depth + 1)
      }

      guard let identifier = view.accessibilityIdentifier.flatMap(meaningfulValue) else { return }
      if identifier.hasPrefix("magic_edit_") || identifier == "native_magic_edit_bubble_host" {
        return
      }
      let frame = view.convert(view.bounds, to: window)
      let area = max(0, frame.width) * max(0, frame.height)
      if area < bestArea || (area == bestArea && depth > bestDepth) {
        bestView = view
        bestArea = area
        bestDepth = depth
      }
    }

    for rootView in window.subviews.reversed() {
      inspect(rootView, depth: 0)
    }
    return bestView
  }

  private func showTarget(label: String, details: String, rect: CGRect, descriptor: [String: Any]) {
    selectedDescriptor = descriptor
    highlightLayer.path = UIBezierPath(roundedRect: rect, cornerRadius: 7).cgPath
    dockTargetLabel.text = label
    dockDetailsLabel.text = details
    selectButton.isEnabled = true
    selectButton.alpha = 1
    targetLabel.text = "  \(label)  "
    let labelWidth = min(bounds.width - 16, max(80, targetLabel.intrinsicContentSize.width + 8))
    let preferredY = rect.minY >= 38 ? rect.minY - 32 : rect.maxY + 6
    targetLabel.frame = CGRect(
      x: min(max(8, rect.minX), bounds.width - labelWidth - 8),
      y: min(max(safeAreaInsets.top + 50, preferredY), bounds.height - 30),
      width: labelWidth,
      height: 26
    )
    targetLabel.isHidden = false
  }

  private func clearTarget() {
    invalidateWebInspection()
    targetView = nil
    selectedDescriptor = nil
    highlightLayer.path = nil
    targetLabel.isHidden = true
    dockTargetLabel.text = "Move the cursor over an element"
    dockDetailsLabel.text = nil
    selectButton.isEnabled = false
    selectButton.alpha = 0.4
  }

  private func selectableView(from rawView: UIView?, in window: UIWindow) -> UIView? {
    guard let rawView else { return nil }
    var current: UIView? = rawView
    var identifiedView: UIView?
    var accessibleView: UIView?
    var fallback: UIView?
    while let view = current, view !== window {
      if view is WKWebView { return view }
      let className = String(describing: type(of: view))
      if identifiedView == nil && meaningful(view.accessibilityIdentifier) { identifiedView = view }
      if accessibleView == nil && (meaningful(view.accessibilityLabel) || view.isAccessibilityElement) {
        accessibleView = view
      }
      if fallback == nil && (className.contains("RCT") || className.contains("React")) {
        fallback = view
      }
      current = view.superview
    }
    return identifiedView ?? accessibleView ?? fallback ??
      (rawView.bounds.width > 1 && rawView.bounds.height > 1 ? rawView : nil)
  }

  private func descriptor(for view: UIView) -> [String: Any] {
    let identifier = view.accessibilityIdentifier?.trimmingCharacters(in: .whitespacesAndNewlines)
    let selector = meaningful(identifier)
      ? "[testID=\"\(escaped(identifier!))\"]"
      : nativeHierarchySelector(for: view)
    let nativeKind = ancestorWebView(from: view) != nil
      ? "webview"
      : reactManaged(view) ? "react-native" : "ios"
    return [
      "label": displayLabel(for: view),
      "selector": selector,
      "screen": screenName(for: view),
      "kind": nativeKind,
    ]
  }

  private func inspectWebTarget(in webView: WKWebView, at point: CGPoint) {
    let enteredWebView = currentWebView !== webView
    currentWebView = webView
    webInspectionGeneration += 1
    let generation = webInspectionGeneration
    pendingWebInspection = (webView, point, generation)
    if enteredWebView {
      selectedDescriptor = nil
      selectButton.isEnabled = false
      selectButton.alpha = 0.4
      highlightLayer.path = nil
      targetLabel.isHidden = true
      dockTargetLabel.text = "Inspecting web element…"
      dockDetailsLabel.text = "Reading DOM metadata…"
    }
    runPendingWebInspection()
  }

  private func descendantView(in root: UIView, matching identifiers: Set<String>) -> UIView? {
    if let identifier = root.accessibilityIdentifier, identifiers.contains(identifier) {
      return root
    }
    for subview in root.subviews.reversed() {
      if let match = descendantView(in: subview, matching: identifiers) { return match }
    }
    return nil
  }

  private func runPendingWebInspection() {
    guard !webInspectionInFlight, let request = pendingWebInspection else { return }
    pendingWebInspection = nil
    webInspectionInFlight = true
    request.webView.evaluateJavaScript(webInspectionScript(at: request.point)) { [weak self, weak webView = request.webView] result, _ in
      guard let self else { return }
      self.webInspectionInFlight = false
      if request.generation == self.webInspectionGeneration,
         let webView,
         self.targetView === webView {
        if let target = self.parsedWebTarget(result) {
          let rect = webView.convert(target.rect, to: self).intersection(self.bounds)
          if rect.width > 0, rect.height > 0 {
            self.showTarget(
              label: target.label,
              details: target.details,
              rect: rect,
              descriptor: target.descriptor
            )
          } else {
            self.clearWebTarget()
          }
        } else {
          self.clearWebTarget()
        }
      }
      self.runPendingWebInspection()
    }
  }

  private func webInspectionScript(at point: CGPoint) -> String {
    """
      (() => {
        const selectableTarget = raw => {
          if (!raw || raw === document.documentElement || raw === document.body) return null;
          if (raw.closest?.('[data-review-comment-ui]')) return null;
          const annotated = raw.closest?.('[data-inspect-id]');
          if (annotated) return annotated;
          return raw.closest?.('button,a,input,textarea,select,label,summary,[role="button"],[role="link"]') || raw;
        };
        let target = null;
        for (const raw of document.elementsFromPoint?.(\(point.x), \(point.y)) || []) {
          target = selectableTarget(raw);
          if (target) break;
        }
        if (!target) target = selectableTarget(document.elementFromPoint?.(\(point.x), \(point.y)));
        if (!target) return null;
        const clean = value => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 240);
        const label = clean(target.getAttribute('aria-label') || target.getAttribute('placeholder') || target.getAttribute('title') || target.textContent || target.value || target.tagName);
        const quote = value => String(value).replaceAll('\\\\', '\\\\\\\\').replaceAll('"', '\\\\"');
        let selector = '';
        if (target.dataset?.inspectId) selector = `[data-inspect-id="${quote(target.dataset.inspectId)}"]`;
        else if (target.id && !target.id.startsWith('rrc-')) selector = `[id="${quote(target.id)}"]`;
        else {
          const parts = [];
          let current = target;
          while (current && current !== document.body && parts.length < 4) {
            const tag = current.tagName.toLowerCase();
            const siblings = current.parentElement ? [...current.parentElement.children].filter(item => item.tagName === current.tagName) : [];
            parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag);
            current = current.parentElement;
          }
          selector = parts.join(' > ') || target.tagName.toLowerCase();
        }
        const rect = target.getBoundingClientRect();
        const tagName = target.tagName.toLowerCase();
        const typeName = clean(target.getAttribute('type'));
        const name = clean(target.getAttribute('name'));
        const id = clean(target.id);
        const className = clean(typeof target.className === 'string' ? target.className : target.getAttribute('class'));
        return {
          label,
          selector,
          screen: document.body.dataset.reviewScreen || document.title || 'Web',
          kind: 'web',
          tagName,
          typeName,
          name,
          id,
          className,
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
        };
      })()
      """
  }

  private func parsedWebTarget(
    _ result: Any?
  ) -> (label: String, details: String, rect: CGRect, descriptor: [String: Any])? {
    guard
      let value = result as? [String: Any],
      let label = value["label"] as? String,
      let selector = value["selector"] as? String,
      let screen = value["screen"] as? String,
      let kind = value["kind"] as? String,
      let rawRect = value["rect"] as? [String: Any],
      let x = rawRect["x"] as? NSNumber,
      let y = rawRect["y"] as? NSNumber,
      let width = rawRect["width"] as? NSNumber,
      let height = rawRect["height"] as? NSNumber
    else { return nil }
    return (
      label,
      webHoverDetails(from: value),
      CGRect(x: x.doubleValue, y: y.doubleValue, width: width.doubleValue, height: height.doubleValue),
      ["label": label, "selector": selector, "screen": screen, "kind": kind]
    )
  }

  private func webHoverDetails(from value: [String: Any]) -> String {
    let tagName = (value["tagName"] as? String).flatMap(meaningfulValue) ?? "element"
    let typeName = (value["typeName"] as? String).flatMap(meaningfulValue)
    let name = (value["name"] as? String).flatMap(meaningfulValue) ?? "—"
    let id = (value["id"] as? String).flatMap(meaningfulValue)
    let className = (value["className"] as? String).flatMap(meaningfulValue) ?? "—"
    let tag = typeName.map { "<\(tagName) type=\"\($0)\">" } ?? "<\(tagName)>"
    let identity = id.map { "name: \(name) · #\($0)" } ?? "name: \(name)"
    return "\(tag) · \(identity)\nclass: \(className)"
  }

  private func nativeHoverDetails(for view: UIView) -> String {
    let platform = reactManaged(view) ? "React Native" : "iOS"
    let typeName = String(describing: type(of: view))
    let name = view.accessibilityIdentifier.flatMap(meaningfulValue)
      ?? view.accessibilityLabel.flatMap(meaningfulValue)
      ?? "—"
    return "\(platform) · \(typeName)\nname: \(name)"
  }

  private func meaningfulValue(_ value: String) -> String? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : String(trimmed.prefix(160))
  }

  private func clearWebTarget() {
    selectedDescriptor = nil
    highlightLayer.path = nil
    targetLabel.isHidden = true
    dockTargetLabel.text = "Move the cursor over an element"
    dockDetailsLabel.text = nil
    selectButton.isEnabled = false
    selectButton.alpha = 0.4
  }

  private func invalidateWebInspection() {
    currentWebView = nil
    webInspectionGeneration += 1
    pendingWebInspection = nil
    if selectedDescriptor?["kind"] as? String == "web" {
      selectedDescriptor = nil
    }
  }

  private func complete(_ value: [String: Any]?) {
    let completion = onComplete
    onComplete = nil
    removeFromSuperview()
    completion?(value)
  }

  private func displayLabel(for view: UIView) -> String {
    let values = [view.accessibilityLabel, view.accessibilityIdentifier]
    if let value = values.compactMap({ $0?.trimmingCharacters(in: .whitespacesAndNewlines) })
      .first(where: { !$0.isEmpty }) {
      return String(value.prefix(240))
    }
    return String(describing: type(of: view))
  }

  private func nativeHierarchySelector(for view: UIView) -> String {
    var parts: [String] = []
    var current: UIView? = view
    while let item = current, !(item is UIWindow), parts.count < 4 {
      let name = String(describing: type(of: item))
      if let siblings = item.superview?.subviews.filter({ type(of: $0) == type(of: item) }), siblings.count > 1,
         let index = siblings.firstIndex(where: { $0 === item }) {
        parts.insert("\(name):nth-of-type(\(index + 1))", at: 0)
      } else {
        parts.insert(name, at: 0)
      }
      current = item.superview
    }
    return "ios:" + parts.joined(separator: " > ")
  }

  private func screenName(for view: UIView) -> String {
    var responder: UIResponder? = view
    while let current = responder {
      if let controller = current as? UIViewController {
        return String(describing: type(of: controller))
      }
      responder = current.next
    }
    return "iOS"
  }

  private func ancestorWebView(from view: UIView) -> WKWebView? {
    var current: UIView? = view
    while let item = current {
      if let webView = item as? WKWebView { return webView }
      current = item.superview
    }
    return nil
  }

  private func reactManaged(_ view: UIView) -> Bool {
    var current: UIView? = view
    while let item = current {
      let name = String(describing: type(of: item))
      if name.contains("RCT") || name.contains("React") { return true }
      current = item.superview
    }
    return false
  }

  private func meaningful(_ value: String?) -> Bool {
    value?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
  }

  private func escaped(_ value: String) -> String {
    value.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
  }
}

private final class MagicEditCommentViewController: UIViewController,
  UITextViewDelegate,
  UIAdaptivePresentationControllerDelegate {
  private let selection: [String: Any]
  private let targetThreads: [[String: Any]]
  private var selectedThreadIndex: Int
  private let threadLinkTarget: MagicEditThreadLinkTarget
  private let scrollView = UIScrollView()
  private let contentStack = UIStackView()
  private let destinationRow = UIStackView()
  private let destinationView = UIButton(type: .system)
  private let destinationSwitcherButton = UIButton(type: .system)
  private let destinationStack = UIStackView()
  private let destinationEyebrowLabel = UILabel()
  private let destinationTitleLabel = UILabel()
  private let destinationChevronView = UIImageView(
    image: UIImage(systemName: "chevron.right")
  )
  private let contextView = UIView()
  private let contextStack = UIStackView()
  private let selectionHeadingView = UIView()
  private let eyebrowLabel = UILabel()
  private let selectionLabel = UILabel()
  private let selectorLabel = UILabel()
  private let promptLabel = UILabel()
  private let commentTextView = UITextView()
  private let placeholderLabel = UILabel()
  private lazy var sendItem = UIBarButtonItem(
    title: "Send",
    style: .done,
    target: self,
    action: #selector(sendComment)
  )
  private var completed = false
  var onComplete: (([String: Any]?) -> Void)?

  init(
    selection: [String: Any],
    targetThreads: [[String: Any]],
    selectedThreadId: String,
    threadLinkTarget: String
  ) {
    let recipients = targetThreads.isEmpty ? [[:]] : targetThreads
    self.selection = selection
    self.targetThreads = recipients
    self.selectedThreadIndex = recipients.firstIndex {
      guard let rawID = $0["id"] as? String else { return false }
      return rawID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        == selectedThreadId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    } ?? 0
    self.threadLinkTarget = MagicEditThreadLinkTarget(rawValue: threadLinkTarget) ?? .app
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    view.accessibilityIdentifier = "magic_edit_native_comment_sheet"
    navigationItem.title = "Add Comment"
    navigationItem.largeTitleDisplayMode = .never

    let cancelItem = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancelComment)
    )
    cancelItem.accessibilityIdentifier = "magic_edit_native_comment_cancel"
    sendItem.accessibilityIdentifier = "magic_edit_native_comment_send"
    sendItem.isEnabled = false
    navigationItem.leftBarButtonItem = cancelItem
    navigationItem.rightBarButtonItem = sendItem

    scrollView.alwaysBounceVertical = false
    scrollView.keyboardDismissMode = .interactive
    scrollView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scrollView)

    contentStack.axis = .vertical
    contentStack.spacing = 10
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    scrollView.addSubview(contentStack)

    destinationView.backgroundColor = UIColor.systemPurple.withAlphaComponent(0.1)
    destinationView.layer.borderColor = UIColor.systemPurple.withAlphaComponent(0.22).cgColor
    destinationView.layer.borderWidth = 1
    destinationView.layer.cornerCurve = .continuous
    destinationView.layer.cornerRadius = 12
    destinationView.accessibilityIdentifier = "magic_edit_native_comment_target_thread"
    destinationView.addTarget(self, action: #selector(openTargetThread), for: .touchUpInside)
    destinationView.setContentHuggingPriority(.required, for: .vertical)

    destinationRow.axis = .horizontal
    destinationRow.alignment = .fill
    destinationRow.spacing = 6
    destinationRow.addArrangedSubview(destinationView)

    destinationSwitcherButton.backgroundColor = UIColor.systemPurple.withAlphaComponent(0.1)
    destinationSwitcherButton.layer.borderColor = UIColor.systemPurple.withAlphaComponent(0.22).cgColor
    destinationSwitcherButton.layer.borderWidth = 1
    destinationSwitcherButton.layer.cornerCurve = .continuous
    destinationSwitcherButton.layer.cornerRadius = 12
    destinationSwitcherButton.setImage(
      UIImage(systemName: "chevron.up.chevron.down", withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .semibold)),
      for: .normal
    )
    destinationSwitcherButton.tintColor = .systemPurple
    destinationSwitcherButton.accessibilityLabel = "Switch recipient thread"
    destinationSwitcherButton.accessibilityIdentifier = "magic_edit_native_comment_thread_switcher"
    destinationSwitcherButton.showsMenuAsPrimaryAction = true
    destinationRow.addArrangedSubview(destinationSwitcherButton)

    destinationStack.axis = .horizontal
    destinationStack.alignment = .firstBaseline
    destinationStack.spacing = 8
    destinationStack.isUserInteractionEnabled = false
    destinationStack.translatesAutoresizingMaskIntoConstraints = false
    destinationView.addSubview(destinationStack)

    destinationEyebrowLabel.text = "SENDING TO"
    destinationEyebrowLabel.font = .systemFont(ofSize: 10, weight: .bold)
    destinationEyebrowLabel.textColor = .systemPurple
    destinationEyebrowLabel.isAccessibilityElement = false
    destinationEyebrowLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    destinationStack.addArrangedSubview(destinationEyebrowLabel)

    destinationTitleLabel.font = .preferredFont(forTextStyle: .subheadline)
    destinationTitleLabel.textColor = .label
    destinationTitleLabel.numberOfLines = 1
    destinationTitleLabel.lineBreakMode = .byTruncatingTail
    destinationTitleLabel.isAccessibilityElement = false
    destinationStack.addArrangedSubview(destinationTitleLabel)

    destinationChevronView.contentMode = .scaleAspectFit
    destinationChevronView.tintColor = .systemPurple
    destinationChevronView.setContentHuggingPriority(.required, for: .horizontal)
    destinationChevronView.setContentCompressionResistancePriority(.required, for: .horizontal)
    destinationStack.addArrangedSubview(destinationChevronView)
    contentStack.addArrangedSubview(destinationRow)
    configureDestination(animated: false)

    contextView.backgroundColor = .secondarySystemGroupedBackground
    contextView.layer.cornerCurve = .continuous
    contextView.layer.cornerRadius = 12
    contextView.accessibilityIdentifier = "magic_edit_native_comment_context"
    contextView.setContentHuggingPriority(.required, for: .vertical)

    contextStack.axis = .vertical
    contextStack.spacing = 3
    contextStack.translatesAutoresizingMaskIntoConstraints = false
    contextView.addSubview(contextStack)

    contextStack.addArrangedSubview(selectionHeadingView)

    eyebrowLabel.text = selectionKind.uppercased()
    eyebrowLabel.font = .systemFont(ofSize: 10, weight: .bold)
    eyebrowLabel.textColor = .systemPurple
    eyebrowLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    eyebrowLabel.accessibilityIdentifier = "magic_edit_native_comment_kind"
    eyebrowLabel.translatesAutoresizingMaskIntoConstraints = false
    selectionHeadingView.addSubview(eyebrowLabel)

    selectionLabel.text = selectionValue("label", fallback: "Unnamed component")
    selectionLabel.font = .preferredFont(forTextStyle: .subheadline)
    selectionLabel.textColor = .label
    selectionLabel.textAlignment = .left
    selectionLabel.numberOfLines = 1
    selectionLabel.lineBreakMode = .byTruncatingTail
    selectionLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)
    selectionLabel.accessibilityIdentifier = "magic_edit_native_comment_selection"
    selectionLabel.translatesAutoresizingMaskIntoConstraints = false
    selectionHeadingView.addSubview(selectionLabel)

    selectorLabel.text = selectionValue("selector", fallback: "Unknown selector")
    selectorLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
    selectorLabel.textColor = .secondaryLabel
    selectorLabel.numberOfLines = 1
    selectorLabel.lineBreakMode = .byTruncatingMiddle
    selectorLabel.accessibilityIdentifier = "magic_edit_native_comment_selector"
    contextStack.addArrangedSubview(selectorLabel)
    contentStack.addArrangedSubview(contextView)

    promptLabel.text = "What should change?"
    promptLabel.font = .preferredFont(forTextStyle: .subheadline)
    promptLabel.textColor = .label
    promptLabel.setContentHuggingPriority(.required, for: .vertical)
    contentStack.addArrangedSubview(promptLabel)

    commentTextView.delegate = self
    commentTextView.backgroundColor = .secondarySystemGroupedBackground
    commentTextView.font = .preferredFont(forTextStyle: .body)
    commentTextView.textColor = .label
    commentTextView.adjustsFontForContentSizeCategory = true
    commentTextView.textContainerInset = UIEdgeInsets(top: 14, left: 12, bottom: 14, right: 12)
    commentTextView.layer.cornerCurve = .continuous
    commentTextView.layer.cornerRadius = 12
    commentTextView.returnKeyType = .default
    commentTextView.accessibilityLabel = "Comment"
    commentTextView.accessibilityIdentifier = "magic_edit_native_comment_input"
    commentTextView.setContentHuggingPriority(.defaultLow, for: .vertical)
    contentStack.addArrangedSubview(commentTextView)

    placeholderLabel.text = "Describe the change you want…"
    placeholderLabel.font = commentTextView.font
    placeholderLabel.textColor = .placeholderText
    placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
    placeholderLabel.isUserInteractionEnabled = false
    commentTextView.addSubview(placeholderLabel)

    let destinationSwitcherWidth = destinationSwitcherButton.widthAnchor.constraint(equalToConstant: 42)
    destinationSwitcherWidth.priority = .defaultHigh
    NSLayoutConstraint.activate([
      scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
      contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 16),
      contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -16),
      contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 10),
      contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -12),
      contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -32),
      contentStack.heightAnchor.constraint(
        greaterThanOrEqualTo: scrollView.frameLayoutGuide.heightAnchor,
        constant: -22
      ),
      destinationStack.leadingAnchor.constraint(equalTo: destinationView.leadingAnchor, constant: 12),
      destinationStack.trailingAnchor.constraint(equalTo: destinationView.trailingAnchor, constant: -12),
      destinationStack.topAnchor.constraint(equalTo: destinationView.topAnchor, constant: 9),
      destinationStack.bottomAnchor.constraint(equalTo: destinationView.bottomAnchor, constant: -9),
      destinationChevronView.widthAnchor.constraint(equalToConstant: 10),
      destinationSwitcherWidth,
      contextStack.leadingAnchor.constraint(equalTo: contextView.leadingAnchor, constant: 12),
      contextStack.trailingAnchor.constraint(equalTo: contextView.trailingAnchor, constant: -12),
      contextStack.topAnchor.constraint(equalTo: contextView.topAnchor, constant: 9),
      contextStack.bottomAnchor.constraint(equalTo: contextView.bottomAnchor, constant: -9),
      eyebrowLabel.leadingAnchor.constraint(equalTo: selectionHeadingView.leadingAnchor),
      eyebrowLabel.firstBaselineAnchor.constraint(equalTo: selectionLabel.firstBaselineAnchor),
      selectionLabel.leadingAnchor.constraint(equalTo: eyebrowLabel.trailingAnchor, constant: 8),
      selectionLabel.trailingAnchor.constraint(lessThanOrEqualTo: selectionHeadingView.trailingAnchor),
      selectionLabel.topAnchor.constraint(equalTo: selectionHeadingView.topAnchor),
      selectionLabel.bottomAnchor.constraint(equalTo: selectionHeadingView.bottomAnchor),
      commentTextView.heightAnchor.constraint(greaterThanOrEqualToConstant: 130),
      placeholderLabel.leadingAnchor.constraint(equalTo: commentTextView.leadingAnchor, constant: 17),
      placeholderLabel.trailingAnchor.constraint(lessThanOrEqualTo: commentTextView.trailingAnchor, constant: -14),
      placeholderLabel.topAnchor.constraint(equalTo: commentTextView.topAnchor, constant: 14),
    ])
  }

  func textViewDidChange(_ textView: UITextView) {
    let hasComment = !textView.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    placeholderLabel.isHidden = !textView.text.isEmpty
    sendItem.isEnabled = hasComment
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish(nil)
  }

  func cancelFromModule() {
    dismissSheet(with: nil)
  }

  @objc private func cancelComment() {
    dismissSheet(with: nil)
  }

  @objc private func sendComment() {
    let comment = commentTextView.text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !comment.isEmpty else { return }
    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    dismissSheet(with: comment)
  }

  @objc private func openTargetThread() {
    UISelectionFeedbackGenerator().selectionChanged()
    let destination = targetThread
    dismissSheet(with: nil) {
      openMagicEditThread(destination, linkTarget: self.threadLinkTarget)
    }
  }

  private var selectionKind: String {
    selectionValue("kind", fallback: "component")
  }

  private var targetThread: [String: Any] {
    targetThreads[selectedThreadIndex]
  }

  private func configureDestination(animated: Bool) {
    let title = targetThreadValue(
      "title",
      fallback: "ACP thread \(targetThreadValue("id", fallback: "").prefix(8))"
    )
    let update = {
      self.destinationTitleLabel.text = title
    }
    if animated && !UIAccessibility.isReduceMotionEnabled {
      UIView.transition(
        with: destinationTitleLabel,
        duration: 0.24,
        options: [.transitionCrossDissolve, .allowAnimatedContent],
        animations: update
      )
    } else {
      update()
    }
    destinationView.accessibilityLabel = "Sending to \(title)"
    destinationView.accessibilityValue = targetThreadValue("id", fallback: "Unknown thread")
    destinationView.accessibilityHint = threadLinkTarget == .web
      ? "Opens this thread in ACP Web"
      : "Opens this thread in the ACP Web app"
    destinationSwitcherButton.isHidden = targetThreads.count < 2
    destinationSwitcherButton.menu = targetThreads.count > 1
      ? UIMenu(
        title: "Send comment to",
        children: targetThreads.enumerated().map { index, thread in
          let title = threadValue(
            thread,
            key: "title",
            fallback: "ACP thread \(threadValue(thread, key: "id", fallback: "").prefix(8))"
          )
          return UIAction(
            title: "Send to \(title)",
            state: index == selectedThreadIndex ? .on : .off
          ) { [weak self] _ in
            self?.selectRecipient(at: index)
          }
        }
      )
      : nil
    destinationSwitcherButton.accessibilityValue = title
  }

  private func selectRecipient(at index: Int) {
    guard targetThreads.indices.contains(index), index != selectedThreadIndex else { return }
    selectedThreadIndex = index
    UISelectionFeedbackGenerator().selectionChanged()
    configureDestination(animated: true)
  }

  private func selectionValue(_ key: String, fallback: String) -> String {
    guard let raw = selection[key] as? String else { return fallback }
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? fallback : String(value.prefix(500))
  }

  private func targetThreadValue(_ key: String, fallback: String) -> String {
    threadValue(targetThread, key: key, fallback: fallback)
  }

  private func threadValue(
    _ thread: [String: Any],
    key: String,
    fallback: String
  ) -> String {
    guard let raw = thread[key] as? String else { return fallback }
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? fallback : String(value.prefix(500))
  }

  private func dismissSheet(with comment: String?, completion: (() -> Void)? = nil) {
    guard !completed else { return }
    commentTextView.resignFirstResponder()
    if let presenter = navigationController?.presentingViewController {
      presenter.dismiss(animated: true) {
        self.finish(comment)
        completion?()
      }
    } else {
      finish(comment)
      completion?()
    }
  }

  private func finish(_ comment: String?) {
    guard !completed else { return }
    completed = true
    let completion = onComplete
    onComplete = nil
    guard let comment else {
      completion?(nil)
      return
    }
    completion?([
      "comment": comment,
      "recipientThreadId": targetThreadValue("id", fallback: ""),
    ])
  }
}

@objc(MagicEditSelectorModule)
final class MagicEditSelectorModule: NSObject {
  private weak var activeOverlay: MagicEditSelectionOverlay?
  private weak var activeCommentController: MagicEditCommentViewController?

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func appMetadata(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let bundle = Bundle.main
    resolve([
      "id": bundle.bundleIdentifier ?? "unknown-app",
      "version": bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
      "build": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
      "platform": "ios",
      "osVersion": UIDevice.current.systemVersion,
      "systemName": UIDevice.current.systemName,
    ])
  }

  @objc func select(
    _ targetThreads: NSArray,
    selectedThreadId: String,
    linkTarget: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      guard self.activeOverlay == nil else {
        reject("magic_edit_busy", "Magic Edit selection is already active", nil)
        return
      }
      guard let window = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .flatMap(\.windows)
        .first(where: \.isKeyWindow) else {
        reject("magic_edit_window_unavailable", "No foreground iOS window is available", nil)
        return
      }
      let overlay = MagicEditSelectionOverlay(
        window: window,
        targetThreads: targetThreads.compactMap { $0 as? [String: Any] },
        selectedThreadId: selectedThreadId,
        threadLinkTarget: linkTarget
      )
      self.activeOverlay = overlay
      overlay.onComplete = { [weak self, weak overlay] selection in
        if self?.activeOverlay === overlay { self?.activeOverlay = nil }
        resolve(selection)
      }
      window.addSubview(overlay)
    }
  }

  @objc func cancel() {
    DispatchQueue.main.async { [weak self] in
      self?.activeOverlay?.cancel()
      self?.activeCommentController?.cancelFromModule()
    }
  }

  @objc func composeComment(
    _ selection: NSDictionary,
    targetThreads: NSArray,
    selectedThreadId: String,
    linkTarget: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      guard self.activeCommentController == nil else {
        reject("magic_edit_comment_busy", "A Magic Edit comment is already open", nil)
        return
      }
      guard let presenter = self.foregroundPresenter() else {
        reject("magic_edit_window_unavailable", "No foreground iOS view controller is available", nil)
        return
      }

      let composer = MagicEditCommentViewController(
        selection: selection as? [String: Any] ?? [:],
        targetThreads: targetThreads.compactMap { $0 as? [String: Any] },
        selectedThreadId: selectedThreadId,
        threadLinkTarget: linkTarget
      )
      let navigation = UINavigationController(rootViewController: composer)
      navigation.modalPresentationStyle = .pageSheet
      navigation.navigationBar.prefersLargeTitles = false
      if let sheet = navigation.sheetPresentationController {
        sheet.detents = [.medium()]
        sheet.selectedDetentIdentifier = .medium
        sheet.prefersGrabberVisible = true
        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        sheet.preferredCornerRadius = 24
      }
      navigation.presentationController?.delegate = composer
      self.activeCommentController = composer
      composer.onComplete = { [weak self, weak composer] comment in
        if self?.activeCommentController === composer { self?.activeCommentController = nil }
        resolve(comment)
      }
      presenter.present(navigation, animated: true)
    }
  }

  private func foregroundPresenter() -> UIViewController? {
    guard let root = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)?
      .rootViewController else { return nil }
    return topViewController(from: root)
  }

  private func topViewController(from controller: UIViewController) -> UIViewController {
    if let presented = controller.presentedViewController {
      return topViewController(from: presented)
    }
    if let navigation = controller as? UINavigationController, let visible = navigation.visibleViewController {
      return topViewController(from: visible)
    }
    if let tabs = controller as? UITabBarController, let selected = tabs.selectedViewController {
      return topViewController(from: selected)
    }
    return controller
  }
}

@objc(MagicEditBubbleManager)
final class MagicEditBubbleManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool { true }
  override func view() -> UIView! { MagicEditBubbleHostView() }
}
