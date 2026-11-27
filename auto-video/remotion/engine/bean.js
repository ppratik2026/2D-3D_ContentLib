// "Bean" characters (night-doodle style): head and body are one soft capsule, thick round arms and legs,
// a tiny face (dot eyes, thick flat brows, a short mouth), beanies / caps / hair. Same parts as the flat actors,
// so poseFlat (IK arms, planted-feet walk, sitting, gestures, faces) animates them.
import * as THREE from 'three';
import { hash, mat, INK, shade, rrect } from './flat.js';

const fill = (geo, c, z = 0) => { const m = new THREE.Mesh(geo, mat(c)); m.position.z = z; return m; };
const caps = (w, h, c, z = 0) => fill(new THREE.ShapeGeometry(rrect(w, h, w / 2), 16), c, z);
// a limb segment with an optional thin dark outline (front arm)
function seg(w, len, c, z, line) { const g = new THREE.Group(); g.position.z = z; const m = caps(w, len + w, c); m.position.y = -len / 2; g.add(m);
  if (line) { const o = caps(w + 0.016, len + w + 0.016, INK, -0.002); o.position.y = -len / 2; g.add(o); } return g; }

function look(ch) { // skin, hat and hair from the character
  const r = `${ch.role || ''} ${ch.name || ''} ${ch.look || ''}`.toLowerCase(); const h = hash(ch.id + 'bean');
  const tan = /tan|brown|dark/.test(r) ? true : /white|pale/.test(r) ? false : h > 0.6;
  const skin = ch.skin_color || (tan ? ['#d8a878', '#cf9f72', '#dcae80'][Math.floor(h * 3)] : ['#ecebdf', '#e6e1d3', '#f1ede2', '#d9d6cf'][Math.floor(h * 4)]);
  let hat = null; const hc = ch.hat_color || (/red/.test(r) ? '#e2452f' : /yellow/.test(r) ? '#f2c230' : /blue/.test(r) ? '#3e5fa8' : null);
  if (/beanie|\bkid\b|little|chhota|brother|\bbhai\b/.test(r) || ch.hat === 'beanie') hat = { type: 'beanie', c: hc || '#e2452f' };
  else if (/cap\b|sport|player|coach/.test(r) || ch.hat === 'cap') hat = { type: 'cap', c: hc || '#3e5fa8' };
  else if (/helmet|worker|builder/.test(r) || ch.hat === 'helmet') hat = { type: 'beanie', c: hc || '#f2c230' };
  const hair = ch.hat === 'none' ? null : !hat && (ch.gender === 'female' || /hair|teacher|mom|maa|girl/.test(r) || h > 0.72) ? { c: ch.hair_color || (h > 0.85 ? '#7a6a5a' : '#3b2f2a'), long: ch.gender === 'female' } : null;
  if (/inner|shadow|anxiety|andar ki|aatma|voice|parchhai|demon/.test(r)) return { skin: '#09090b', hat: null, hair: null, shadow: true };
  return { skin, hat, hair };
}

export function createBeanActor(scene, ch) {
  const kid = ch.age === 'child', old = ch.age === 'old'; const H = kid ? 1.2 : 1.72; const k = H / 1.72; const L = look(ch);
  const skin = L.skin, dark = shade(skin, 0.8), darker = shade(skin, 0.68);
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const legLen = (kid ? 0.38 : 0.47) * k, thigh = legLen * 0.5, shin = legLen * 0.5; const W = (kid ? 0.66 : 0.64) * k; const capH = H - legLen; // the bean
  const hipY = legLen, chestY = hipY + capH * 0.55, headR = W / 2, headY = H - headR; const armU = capH * 0.27, armL = capH * 0.25; const lw = 0.165 * k, aw = 0.135 * k;
  const a = { shadow: !!L.shadow, flat: true, bean: true, o: root, height: H, hipY, bones: {}, face: [], hasLipSync: true, ch, id: ch.id, H, legLen };
  const mkLeg = (c, z, x) => { const top = new THREE.Group(); top.position.set(x, hipY + lw * 0.2, z); const up = seg(lw, thigh, c, 0); top.add(up); const knee = new THREE.Group(); knee.position.y = -thigh; top.add(knee);
    const lo = seg(lw, shin, c, 0.001); knee.add(lo); const end = new THREE.Group(); end.position.y = -shin; knee.add(end); const foot = caps(lw * 1.45, lw * 0.95, c, 0.002); foot.rotation.z = Math.PI / 2; foot.position.set(lw * 0.3, -lw * 0.15, 0); end.add(foot); return { top, knee, end }; };
  const legB = mkLeg(darker, -0.04, -0.06 * k), legF = mkLeg(dark, 0.04, 0.06 * k); body.add(legB.top, legF.top);
  // the capsule (head + body): slightly wider at the top
  const torso = new THREE.Group(); torso.position.set(0, hipY + capH / 2, 0); body.add(torso);
  const shape = new THREE.Shape(); const hw = W / 2, bw = W * 0.47, top = capH / 2, bot = -capH / 2;
  shape.moveTo(-bw, bot + bw); shape.absarc(0, bot + bw, bw, Math.PI, 0, false); shape.lineTo(hw, top - hw); shape.absarc(0, top - hw, hw, 0, Math.PI, false); shape.lineTo(-bw, bot + bw);
  const bean = fill(new THREE.ShapeGeometry(shape, 24), skin, 0); torso.add(bean);
  const deco = new THREE.Group(); torso.add(deco);
  // arms: the back arm is hidden behind the bean (darker), the front arm has a thin dark outline
  const mkArm = (c, z, line) => { const top = new THREE.Group(); top.position.z = z; top.add(seg(aw, armU, c, 0, line)); const knee = new THREE.Group(); knee.position.y = -armU; top.add(knee);
    knee.add(seg(aw, armL, c, 0.001, line)); const end = new THREE.Group(); end.position.y = -armL; knee.add(end); return { top, knee, end }; };
  const armB = mkArm(dark, -0.05, false), armF = mkArm(skin, 0.06, true); const shY = hipY + capH * 0.44;
  armB.top.position.set(-W * 0.12, shY, -0.05); armF.top.position.set(W * 0.12, shY, 0.06); body.add(armB.top, armF.top);
  // face (on the upper part of the bean)
  const head = new THREE.Group(); head.position.set(0, headY, 0.08); body.add(head);
  const back = new THREE.Group(); head.add(back); const face = new THREE.Group(); face.position.z = 0.01; head.add(face);
  const eyes = [], lids = []; const ex = W * 0.17;
  for (const dx of [-ex, ex]) { const e = fill(new THREE.CircleGeometry(0.036 * k, 16), INK, 0.004); e.position.set(dx, -headR * 0.05, 0); face.add(e); eyes.push(e);
    const lid = fill(new THREE.PlaneGeometry(0.09 * k, 0.08 * k), skin, 0.006); lid.position.set(dx, 0, 0); lid.scale.y = 0.01; face.add(lid); lids.push(lid); }
  if (L.shadow) eyes.forEach((e) => e.material.color.set('#ff5a3a'));
  const brows = [-ex, ex].map((dx) => { const b = fill(new THREE.ShapeGeometry(rrect(0.1 * k, 0.026 * k, 0.012 * k)), INK, 0.007); b.position.set(dx, headR * 0.22, 0); face.add(b); return b; });
  const bags = new THREE.Group(); bags.visible = false; face.add(bags); for (const dx of [-ex, ex]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.035 * k, 0.005 * k, 4, 12, Math.PI * 0.7), mat('#8a8a8a')); b.rotation.z = Math.PI * 1.15; b.position.set(dx, -headR * 0.2, 0.005); bags.add(b); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05 * k, 0.008 * k, 5, 16, Math.PI * 0.7), mat(INK)); smile.position.set(0, -headR * 0.42, 0.006); face.add(smile);
  const smileNeutral = fill(new THREE.ShapeGeometry(rrect(0.07 * k, 0.014 * k, 0.007 * k)), INK, 0.006); smileNeutral.position.set(0, -headR * 0.42, 0); face.add(smileNeutral);
  const mouthO = new THREE.Group(); mouthO.position.set(0, -headR * 0.47, 0.006); face.add(mouthO); mouthO.add(fill(new THREE.CircleGeometry(0.035 * k, 18), '#2b1414'), fill(new THREE.CircleGeometry(0.018 * k, 12), '#e05a6a', 0.001)); mouthO.children[1].position.y = -0.012 * k;
  // hair / hats (front parts in hairTop so the back view can hide the face only)
  const hairTop = new THREE.Group(), hairLine = new THREE.Group(); head.add(hairTop, hairLine);
  if (L.hair) { const hr = new THREE.Mesh(new THREE.CircleGeometry(headR * 1.04, 32, 0, Math.PI), mat(L.hair.c)); hr.position.set(0, headR * 0.3, 0.012); hr.scale.y = 0.9; hairTop.add(hr); const fr = fill(new THREE.ShapeGeometry(rrect(W * 1.0, headR * 0.22, headR * 0.1)), L.hair.c, 0.0125); fr.position.set(0, headR * 0.33, 0); hairTop.add(fr);
    if (L.hair.long) { const lb = fill(new THREE.ShapeGeometry(rrect(W * 1.08, headR * 2.7, headR * 0.9)), L.hair.c, 0); lb.position.set(-W * 0.03, headY - headR * 0.4, -0.12); body.add(lb); } } /* long hair hangs behind the bean */
  if (L.hat?.type === 'beanie') { const b = fill(new THREE.CircleGeometry(headR * 1.05, 32, 0, Math.PI), L.hat.c, 0.014); b.position.set(0, headR * 0.3, 0); b.scale.y = 0.95; hairTop.add(b);
    const band = fill(new THREE.ShapeGeometry(rrect(W * 1.06, headR * 0.34, headR * 0.15)), shade(L.hat.c, 0.85), 0.015); band.position.set(0, headR * 0.32, 0); hairTop.add(band);
    const pom = fill(new THREE.CircleGeometry(headR * 0.2, 16), shade(L.hat.c, 1.05), 0.013); pom.position.set(0, headR * 1.32, 0); hairTop.add(pom);
    for (let i = -2; i <= 2; i++) { const r = fill(new THREE.PlaneGeometry(0.006, headR * 0.6), shade(L.hat.c, 0.8), 0.0145); r.position.set(i * headR * 0.28, headR * 0.82, 0); hairTop.add(r); } }
  if (L.hat?.type === 'cap') { const c = fill(new THREE.CircleGeometry(headR * 1.04, 32, 0, Math.PI), L.hat.c, 0.014); c.position.set(0, headR * 0.35, 0); c.scale.y = 0.75; hairTop.add(c);
    const brim = fill(new THREE.ShapeGeometry(rrect(headR * 1.2, headR * 0.16, headR * 0.08)), shade(L.hat.c, 0.75), 0.015); brim.position.set(headR * 0.65, headR * 0.36, 0); hairTop.add(brim); }
  const backHair = new THREE.Group(); backHair.visible = false; head.add(backHair); if (L.hair || L.hat) { const bh = fill(new THREE.CircleGeometry(headR * 1.03, 32, 0, Math.PI), (L.hat || L.hair).c, 0.03); bh.position.y = headR * 0.2; backHair.add(bh); }
  const mk = (parent, x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
  a.bones.Head = mk(head, 0, 0); a.bones.RightHand = armF.end; a.bones.LeftHand = armB.end; a.bones.RightFoot = legF.end; a.bones.LeftFoot = legB.end; a.bones.Hips = mk(body, 0, hipY);
  a.parts = { deco, root, body, head, face, back, backHair, hairTop, hairLine, eyes, lids, brows, smile, smileNeutral, mouthO, bags, armF, armB, legF, legB, torso, shoulderF: armF.top.position.clone(), shoulderB: armB.top.position.clone(), armU, armL, chestY, headY, headR, thigh, shin, k,
    fx: { eyeX: ex, eyeY: -headR * 0.05, lidY: 0.02 * k, lidDrop: 0.03 * k, browY: headR * 0.22, browUp: 0.03 * k, browBase: 0.12, smileY: -headR * 0.38, frownY: -headR * 0.5, look: 0.09 * k, shift: W * 0.2, mouthShift: 0.07 * k },
    smileUp: Math.PI * 1.15, smileDown: Math.PI * 0.15, bodyColors: [skin, dark, darker] };
  a.materials = []; root.traverse((o) => { if (o.isMesh) a.materials.push({ m: o.material, base: o.material.color.clone() }); }); // for depth fading
  scene.add(root); return a;
}
