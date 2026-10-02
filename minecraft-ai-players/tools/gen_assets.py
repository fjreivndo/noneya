#!/usr/bin/env python3
"""Generates the resource-pack assets for AI Players.

* 48 random 64x64 player skins (wide and slim arms) in standard skin layout
* player geometry (wide + slim)
* render controller texture array + client entity texture list
* controller item icon

Run:  python3 tools/gen_assets.py      (needs Pillow)
The skin count must match SKIN_COUNT in BP/scripts/config.js.
"""
import json
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "RP")
SKIN_COUNT = 48
SLIM_EVERY = 3  # every 3rd skin uses slim arms (index % 3 == 2)

rng = random.Random(1337)

SKIN_TONES = [(255, 220, 177), (241, 194, 125), (224, 172, 105), (198, 134, 66),
              (141, 85, 36), (110, 66, 32), (255, 205, 148), (234, 192, 134), (92, 56, 30)]
HAIR = [(40, 26, 13), (70, 45, 20), (110, 70, 30), (200, 160, 80), (230, 210, 140),
        (160, 50, 20), (20, 20, 20), (120, 120, 120), (230, 230, 230), (60, 90, 200),
        (200, 60, 150), (40, 140, 70)]
CLOTH = [(0, 170, 170), (40, 70, 160), (180, 30, 30), (30, 120, 40), (230, 180, 30),
         (120, 40, 150), (240, 240, 240), (40, 40, 40), (230, 120, 30), (90, 60, 40),
         (250, 120, 160), (60, 160, 220), (130, 130, 130), (20, 60, 30), (150, 0, 60)]
PANTS = [(60, 50, 140), (30, 30, 40), (90, 70, 50), (40, 70, 120), (110, 110, 110),
         (20, 50, 20), (120, 20, 20), (200, 190, 160)]
SHOES = [(60, 60, 60), (30, 30, 30), (110, 70, 40), (230, 230, 230), (150, 30, 30)]
EYES = [(60, 90, 200), (40, 120, 60), (90, 60, 30), (30, 30, 30), (120, 160, 220)]


def jitter(c, amt=10):
    return tuple(max(0, min(255, v + rng.randint(-amt, amt))) for v in c[:3]) + (255,)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


class Skin:
    def __init__(self):
        self.img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        self.px = self.img.load()

    def rect(self, x, y, w, h, color_fn):
        for i in range(w):
            for j in range(h):
                c = color_fn(i, j)
                if c is not None:
                    self.px[x + i, y + j] = c

    def box(self, u, v, w, h, d, fn):
        """Paints a box-uv cuboid. fn(face, i, j, fw, fh) -> color|None."""
        faces = {
            "top": (u + d, v, w, d),
            "bottom": (u + d + w, v, w, d),
            "right": (u, v + d, d, h),
            "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h),
            "back": (u + d + w + d, v + d, w, h),
        }
        for name, (x, y, fw, fh) in faces.items():
            self.rect(x, y, fw, fh, lambda i, j, n=name, fw=fw, fh=fh: fn(n, i, j, fw, fh))


def make_skin(slim):
    s = Skin()
    skin = rng.choice(SKIN_TONES)
    hair = rng.choice(HAIR)
    shirt = rng.choice(CLOTH)
    shirt2 = rng.choice(CLOTH)
    pants = rng.choice(PANTS)
    shoes = rng.choice(SHOES)
    eye = rng.choice(EYES)
    hair_len = rng.choice([1, 2, 2, 3, 5, 7])  # rows of hair on the sides
    fringe = rng.choice([1, 1, 2, 2, 3])
    beard = rng.random() < 0.15
    pattern = rng.choice(["plain", "stripe", "split", "vest", "logo", "hoodie"])
    sleeve = rng.choice([3, 5, 12])  # sleeve length (rows of the arm)
    hat = rng.random() < 0.25
    hat_col = rng.choice(CLOTH)

    def head(face, i, j, fw, fh):
        if face == "top":
            return jitter(hair)
        if face == "bottom":
            return jitter(skin)
        if face == "back":
            return jitter(hair) if j < max(hair_len + 1, 4) else jitter(skin)
        if face in ("left", "right"):
            if j < hair_len:
                return jitter(hair)
            if j < fringe:
                return jitter(hair)
            return jitter(skin)
        # front
        if j < fringe:
            return jitter(hair)
        if j == 4 and i in (1, 2, 5, 6):
            if i in (1, 6):
                return (255, 255, 255, 255)
            return eye + (255,)
        if j == 6 and 3 <= i <= 4:
            return shade(skin, 0.7)
        if beard and j >= 6:
            return jitter(hair)
        return jitter(skin, 6)

    s.box(0, 0, 8, 8, 8, head)
    if hat:
        def hat_fn(face, i, j, fw, fh):
            if face == "top":
                return jitter(hat_col)
            if face == "bottom":
                return None
            return jitter(hat_col) if j < 2 else None
        s.box(32, 0, 8, 8, 8, hat_fn)

    def body(face, i, j, fw, fh):
        base = shirt
        if pattern == "stripe" and j % 4 < 2:
            base = shirt2
        elif pattern == "split" and face == "front" and i >= fw // 2:
            base = shirt2
        elif pattern == "vest" and face == "front" and 2 <= i <= 5:
            base = shirt2
        elif pattern == "logo" and face == "front" and 2 <= i <= 5 and 3 <= j <= 6:
            base = shirt2
        elif pattern == "hoodie" and face == "front" and j < 2:
            base = shade(shirt, 0.75)
        if j >= 10 and face != "top":
            base = shade(shirt, 0.8)  # belt-ish line
        return jitter(base)

    s.box(16, 16, 8, 12, 4, body)

    aw = 3 if slim else 4

    def arm(face, i, j, fw, fh):
        if face == "top":
            return jitter(shirt)
        if face == "bottom":
            return jitter(skin)
        if j < sleeve:
            return jitter(shirt if pattern != "stripe" or j % 4 >= 2 else shirt2)
        return jitter(skin, 6)

    s.box(40, 16, aw, 12, 4, arm)   # right arm
    s.box(32, 48, aw, 12, 4, arm)   # left arm

    def leg(face, i, j, fw, fh):
        if face == "top":
            return jitter(pants)
        if face == "bottom" or j >= 10:
            return jitter(shoes)
        return jitter(pants)

    s.box(0, 16, 4, 12, 4, leg)     # right leg
    s.box(16, 48, 4, 12, 4, leg)    # left leg
    return s.img


def cube(origin, size, uv, inflate=0.0):
    c = {"origin": origin, "size": size, "uv": uv}
    if inflate:
        c["inflate"] = inflate
    return c


def geometry(identifier, slim):
    aw = 3 if slim else 4
    r_arm_x = -7 if slim else -8
    bones = [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
        {"name": "body", "parent": "waist", "pivot": [0, 24, 0],
         "cubes": [cube([-4, 12, -2], [8, 12, 4], [16, 16])]},
        {"name": "jacket", "parent": "body", "pivot": [0, 24, 0],
         "cubes": [cube([-4, 12, -2], [8, 12, 4], [16, 32], 0.25)]},
        {"name": "head", "parent": "body", "pivot": [0, 24, 0],
         "cubes": [cube([-4, 24, -4], [8, 8, 8], [0, 0])]},
        {"name": "hat", "parent": "head", "pivot": [0, 24, 0],
         "cubes": [cube([-4, 24, -4], [8, 8, 8], [32, 0], 0.5)]},
        {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0],
         "cubes": [cube([r_arm_x, 12, -2], [aw, 12, 4], [40, 16])]},
        {"name": "rightSleeve", "parent": "rightArm", "pivot": [-5, 22, 0],
         "cubes": [cube([r_arm_x, 12, -2], [aw, 12, 4], [40, 32], 0.25)]},
        {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
        {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0],
         "cubes": [cube([4, 12, -2], [aw, 12, 4], [32, 48])]},
        {"name": "leftSleeve", "parent": "leftArm", "pivot": [5, 22, 0],
         "cubes": [cube([4, 12, -2], [aw, 12, 4], [48, 48], 0.25)]},
        {"name": "leftItem", "parent": "leftArm", "pivot": [6, 15, 1]},
        {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0],
         "cubes": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16])]},
        {"name": "rightPants", "parent": "rightLeg", "pivot": [-1.9, 12, 0],
         "cubes": [cube([-3.9, 0, -2], [4, 12, 4], [0, 32], 0.25)]},
        {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0],
         "cubes": [cube([-0.1, 0, -2], [4, 12, 4], [16, 48])]},
        {"name": "leftPants", "parent": "leftLeg", "pivot": [1.9, 12, 0],
         "cubes": [cube([-0.1, 0, -2], [4, 12, 4], [0, 48], 0.25)]},
    ]
    return {
        "description": {
            "identifier": identifier,
            "texture_width": 64,
            "texture_height": 64,
            "visible_bounds_width": 2,
            "visible_bounds_height": 3,
            "visible_bounds_offset": [0, 1.5, 0],
        },
        "bones": bones,
    }


def controller_icon():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()
    for x in range(3, 13):
        for y in range(2, 14):
            p[x, y] = (40, 40, 52, 255)
    for x in range(4, 12):
        for y in range(3, 9):
            p[x, y] = (30, 160, 220, 255)
    # little face on the screen
    for x, y in ((6, 5), (9, 5)):
        p[x, y] = (255, 255, 255, 255)
    for x in range(6, 10):
        p[x, 7] = (255, 255, 255, 255)
    for x, y, c in ((5, 11, (220, 50, 50)), (8, 11, (60, 200, 80)), (10, 11, (240, 200, 40))):
        p[x, y] = c + (255,)
    return img


def main():
    skin_dir = os.path.join(RP, "textures", "entity", "aip_skins")
    os.makedirs(skin_dir, exist_ok=True)
    for i in range(SKIN_COUNT):
        make_skin(slim=(i % SLIM_EVERY == 2)).save(os.path.join(skin_dir, f"skin_{i}.png"))

    geo = {"format_version": "1.12.0", "minecraft:geometry": [
        geometry("geometry.aip.player_wide", False),
        geometry("geometry.aip.player_slim", True)]}
    with open(os.path.join(RP, "models", "entity", "ai_player.geo.json"), "w") as f:
        json.dump(geo, f, indent=1)

    ent_path = os.path.join(RP, "entity", "ai_player.entity.json")
    with open(ent_path) as f:
        ent = json.load(f)
    ent["minecraft:client_entity"]["description"]["textures"] = {
        f"skin_{i}": f"textures/entity/aip_skins/skin_{i}" for i in range(SKIN_COUNT)}
    with open(ent_path, "w") as f:
        json.dump(ent, f, indent=2)

    rc = {"format_version": "1.10.0", "render_controllers": {"controller.render.aip.player": {
        "arrays": {"textures": {"Array.skins": [f"Texture.skin_{i}" for i in range(SKIN_COUNT)]}},
        "geometry": "query.property('aip:slim') ? Geometry.slim : Geometry.wide",
        "materials": [{"*": "Material.default"}],
        "textures": ["Array.skins[query.property('aip:skin')]"],
    }}}
    with open(os.path.join(RP, "render_controllers", "ai_player.render_controllers.json"), "w") as f:
        json.dump(rc, f, indent=2)

    os.makedirs(os.path.join(RP, "textures", "items"), exist_ok=True)
    controller_icon().save(os.path.join(RP, "textures", "items", "aip_controller.png"))

    # pack icons
    for pack in ("BP", "RP"):
        icon = make_skin(False).crop((8, 8, 16, 16)).resize((128, 128), Image.NEAREST)
        icon.save(os.path.join(ROOT, pack, "pack_icon.png"))
    print(f"generated {SKIN_COUNT} skins, geometry, render controller, icons")


if __name__ == "__main__":
    main()
