import ExpoModulesCore

public class GlassViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlassView")

    View(GlassView.self) {
      Prop("cornerRadius") { (view: GlassView, val: Double) in
        view.cornerRadius = val
      }
    }
  }
}
