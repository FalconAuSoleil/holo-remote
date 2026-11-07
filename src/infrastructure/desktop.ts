import type { InputPort, ScreenPort } from "../application/ports";

// À lancer sur le PC pilotable (pas dans WSL : il n'a pas accès à l'écran Windows).
export function desktopScreen(): ScreenPort {
  return {
    async capture() {
      const { default: screenshot } = await import("screenshot-desktop");
      const png = await screenshot({ format: "png" });
      // IHDR : largeur et hauteur en gros-boutiste aux octets 16 et 20.
      return { pngBase64: png.toString("base64"), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    },
    async screenSize() {
      const { screen } = await import("@nut-tree-fork/nut-js");
      return { width: await screen.width(), height: await screen.height() };
    },
  };
}

export function desktopInput(): InputPort {
  const nut = () => import("@nut-tree-fork/nut-js");
  return {
    async click(x, y, double = false) {
      const { mouse, straightTo, Point, Button } = await nut();
      await mouse.move(straightTo(new Point(x, y)));
      if (double) await mouse.doubleClick(Button.LEFT);
      else await mouse.click(Button.LEFT);
    },
    async type(text) {
      const { keyboard } = await nut();
      await keyboard.type(text);
    },
    async key(keys) {
      const { keyboard, Key } = await nut();
      const names = keys.split("+").map((k) => k.trim());
      const resolved = names.map((n) => {
        const found = Object.keys(Key).find((k) => k.toLowerCase() === (ALIASES[n.toLowerCase()] ?? n).toLowerCase());
        if (!found) throw new Error(`Touche inconnue : ${n}`);
        return Key[found as keyof typeof Key];
      });
      await keyboard.pressKey(...resolved);
      await keyboard.releaseKey(...resolved);
    },
    async scroll(x, y, dy) {
      const { mouse, straightTo, Point } = await nut();
      await mouse.move(straightTo(new Point(x, y)));
      if (dy > 0) await mouse.scrollDown(Math.round(dy));
      else await mouse.scrollUp(Math.round(-dy));
    },
  };
}

const ALIASES: Record<string, string> = { ctrl: "LeftControl", control: "LeftControl", alt: "LeftAlt", shift: "LeftShift", cmd: "LeftSuper", win: "LeftSuper", enter: "Enter", esc: "Escape" };
