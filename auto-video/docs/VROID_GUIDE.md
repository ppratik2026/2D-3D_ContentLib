# Making Indian characters in VRoid Studio (free)

VRoid Studio is a free Windows/Mac program from Pixiv. It makes anime/cartoon 3D characters and exports **.vrm** files.
**.vrm is the best format for Auto Video Studio:**
- It has a standard skeleton, so walking, sitting and gestures work.
- It has mouth shapes, so lip-sync works.
- Its toon shading matches the 2D Cartoon Stage.

Download: **vroid.com/en/studio**, or Steam → "VRoid Studio". Free, no account needed to export.

---

## 1. Plan your cast (10–12 characters)

Make one fixed cast and reuse it in every video, like a real channel does. Example family + village cast:

| Role | Gender / age in app | Look |
|---|---|---|
| Dadaji (grandfather) | Male / Old | White hair and moustache, kurta-dhoti, shawl, spectacles |
| Dadiji (grandmother) | Female / Old | White bun, cotton saree, bindi |
| Papa | Male / Adult | Short black hair, moustache, shirt + trousers |
| Mummy | Female / Adult | Long plait, saree or salwar suit, bindi, bangles |
| Bada beta (hero) | Male / Young | Modern hair, t-shirt + jeans |
| Beti / heroine | Female / Young | Long hair, kurti + leggings or lehenga |
| Chhota bhai (kid) | Male / Child | Short hair, school shirt + shorts |
| Chhoti behen (kid) | Female / Child | Two plaits, frock |
| Inspector | Male / Adult | Khaki uniform, cap, belt, moustache |
| Villain / zamindar | Male / Adult | Big moustache, white kurta, black waistcoat, gold chain |
| Doctor / teacher | Female / Adult | Short hair, white coat or saree |
| Ghost (horror) | Female / Young | Long open hair, white saree, pale skin, dark eyes |

Make 2 or 3 more as "extras" (shopkeeper, neighbour, constable). The app re-uses extras for small roles.

---

## 2. Body and face

1. **New → Female or Male.**
2. **Face tab:**
   - Use **Eye → smaller iris and less sparkle**. The default anime eyes are very big; smaller looks more Indian-cartoon.
   - Make the nose a little bigger and visible (Nose → height / size).
   - Use **Eyebrows → thicker**.
   - Add a **moustache**: Face → Face paint (Makeup). Draw a dark moustache shape, or use a free moustache texture from the VRoid Hub/Booth.
   - Add a **bindi**: Face paint → draw a small red dot between the eyebrows.
3. **Skin colour (most important):**
   - Go to **Face → Skin → Edit texture → Color adjustment**.
   - Pick a **warm brown** (e.g. `#C68A5E`, `#B07850`, `#8D5A3B`).
   - Do the same for **Body → Skin** so the face and body match.
4. **Body tab:**
   - Kids: height around 0.6–0.7 and a bigger head ratio.
   - Old people: slightly shorter and wider body.
   - Villain: wider shoulders and belly.

## 3. Hair

- Use the **Hairstyle** presets, then change the colour to **black / dark brown** (`#1C1612`). For old characters use white/grey.
- **Plait (choti):** Hair → Hair list → add a "Braid" preset at the back.
- **Bun (joora):** use a bun preset at the back of the head.
- Keep hair **not too long and spiky**. Very long loose hair moves through the body when walking.

## 4. Clothes (Indian outfits)

VRoid's built-in clothes are Japanese/western. For Indian clothes, use one of these options:

1. **Recolour + edit texture (easiest):**
   - Choose **Tops → long tunic / dress** and **Bottoms → long skirt or pants**.
   - Click **Edit texture** and paint kurta borders, saree prints or uniform pockets on the texture.
   - Kurta = long shirt preset + pyjama pants, in white or cream.
   - Salwar suit = long shirt + loose pants + a dupatta drawn on the texture.
   - Saree = long dress preset + border painted at the bottom, plus a pallu shape painted over one shoulder.
   - Police = shirt + trousers in khaki `#B59A63`, with a dark belt painted on, plus a cap accessory.
2. **Free/paid outfit textures:**
   - Search **Booth.pm** or **VRoid Hub** for "saree VRoid", "kurta VRoid" or "Indian VRoid". Import with **Edit texture → Import**.
3. **Accessories:**
   - Spectacles, caps and hair flowers are in **Accessories**.
   - Bangles and chains can be painted on the texture.

**Avoid:**
- Big flowing capes and very loose dupattas made of separate hair-cloth bones. They clip through the body when the character walks or sits.
- Fully transparent lace parts. Use solid colours; transparent pieces can show as holes.

## 5. Export to VRM

1. Click the **Camera/Export** button (top right) → **Export as VRM**.
2. Export settings:
   - **VRM version: VRM 0.0 or VRM 1.0** (both work).
   - **Reduce polygons: ON**. Target around **20,000–30,000 triangles**, which keeps rendering fast on the i5 PCs.
   - **Texture atlas: ON**, texture size **2048**. Use 1024 if you have many characters.
   - **Bone reduction for hair/cloth: ON** (lighter).
3. Fill in a title/author (anything) and save, e.g. `dadaji.vrm`.

## 6. Import into Auto Video Studio

1. Open **Characters → + Import** (or drag the .vrm files into the window).
2. The preview walks the character in a circle and talks. Check:
   - "✓ Works · VRM · lip-sync: yes" is shown.
   - No grey shapes, holes or floating parts.
3. Fill in:
   - **Name** — the role, e.g. "Dadaji".
   - **Gender** and **Age**. The story AI uses these to cast the character.
   - **Tags** — role words like `grandfather, kurta, village, old`, `police, inspector, uniform`, or `ghost, horror, white saree`. The AI matches story roles to these tags.
   - **Voice** — pick a fixed voice and press **▶ Play** to hear it. The character always speaks with this voice in every video.
   - **Styles** — tick **Toon / 2D** so the character is used in the 2D Cartoon Stage.
4. **Save.**

### Suggested voices

| Character | Voice |
|---|---|
| Dadaji | Old man — dada / baba |
| Dadiji | Old woman — dadi / nani |
| Papa | Omega — man (warm) |
| Inspector | Deep voice — inspector / boss |
| Mummy | Strong woman — officer / mother |
| Hero | Rohan — young man |
| Heroine | Beta — young woman |
| Kids | Little boy / Little girl |
| Villain | Heavy voice — villain |
| Ghost | Alpha — woman (soft), or Old woman 2 for a scarier voice |

---

## 7. Common problems

| Problem | Fix |
|---|---|
| Character too bright / too dark on the background | Change the skin texture colour; the stage adds day/night tint automatically |
| Hair or dupatta goes through the body | Shorten it, or turn off its swing bones in VRoid (Hair → bone settings) |
| Grey outline shapes around clothes | Avoid semi-transparent cloth parts; use solid colours |
| "Rig problem" when importing a .glb/.fbx | Use .vrm from VRoid, or a Mixamo-rigged model; IK-only rigs don't work |
| PC slow with 10+ characters | Export with polygon reduction and 1024 textures |
| Two characters look the same | Change hair style + outfit colour; viewers recognise characters mostly by **hair + clothes colour** |
