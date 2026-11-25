// Character preview for the Characters screen: loads any .vrm/.glb/.fbx with the real engine code, walks it in a circle.
import * as THREE from 'three';
import { loadActorKit, createActor, poseActor } from '../../remotion/engine/actors.js';

const url = (rel) => 'av://data/' + rel.split('/').map(encodeURIComponent).join('/');
let kitP = null, cur = null;

async function show(canvas, char) {
  if (cur) { cur.stop = true; cur.renderer.dispose(); cur = null; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(1); renderer.setSize(canvas.clientWidth || 360, canvas.clientHeight || 420, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.05, 50); cam.position.set(0, 1.25, 4.6); cam.lookAt(0, 0.9, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 5, 3); sun.castShadow = true; scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: 0x2a2f3c })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const me = { renderer, stop: false }; cur = me;
  kitP ||= loadActorKit(url);
  const kit = await kitP;
  const ch = { id: 'preview', name: char.name, gender: char.gender, age: char.age, top_color: '#3a6ea5', bottom_color: '#2b2b30', hair_color: '#1c1612' };
  let a;
  try { a = await createActor(kit, scene, ch, { file: char.file, type: char.type }); }
  catch (e) { renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.dispose(); return { ok: false, error: String(e.message || e) }; }
  if (me.stop) return { ok: true };
  const t0 = performance.now();
  const loop = () => { if (me.stop) return; const t = (performance.now() - t0) / 1000; const ang = t * 0.5;
    const walking = Math.floor(t / 6) % 2 === 0; const r = 1.1;
    const pos = walking ? new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r) : new THREE.Vector3(0, 0, 0);
    const yaw = walking ? ang + Math.PI / 2 : 0;
    poseActor(a, t, { visible: true, pos, yaw, walk: walking ? 1 : 0, mouth: walking ? 0 : Math.abs(Math.sin(t * 9)) * 0.8, talk: walking ? 0 : 0.5, emotion: 'happy', look: new THREE.Vector3(cam.position.x, 1.5, cam.position.z) });
    renderer.render(scene, cam); requestAnimationFrame(loop); };
  loop();
  return { ok: true, lipSync: a.hasLipSync, rig: a.vrm ? 'VRM' : 'Humanoid' };
}
window.AVPreview = { show };
