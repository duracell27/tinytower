import ExpoModulesCore
import UIKit

class GlassView: ExpoView {
  private let effectView: UIVisualEffectView

  required init(appContext: AppContext? = nil) {
    if #available(iOS 26.0, *) {
      effectView = UIVisualEffectView(effect: UIGlassEffect())
    } else {
      effectView = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
    }
    super.init(appContext: appContext)
    effectView.frame = bounds
    effectView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    insertSubview(effectView, at: 0)
    clipsToBounds = true
  }

  @objc var cornerRadius: Double = 0 {
    didSet { layer.cornerRadius = cornerRadius }
  }
}
