import * as THREE from 'three';
import { ARMAS, esCuerpoACuerpo, type Arma } from '../core/armas';
import { LIMITE_X, LIMITE_Z, type Bloque } from '../core/mapa';
import { animateWalk, createAvatar, DEFAULT_LOOK, LOOK_OPTIONS, type Look } from './characters';
import { ALTURA_OJOS, Partida, type Soldado } from './logica';

const cacheMat = new Map<string, THREE.Material>();
function mat(color: number, basico = false, opacidad = 1): THREE.Material {
  const clave = `${color}|${basico}|${opacidad}`;
  let m = cacheMat.get(clave);
  if (!m) {
    const o = { color, transparent: opacidad < 1, opacity: opacidad };
    m = basico ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o);
    cacheMat.set(clave, m);
  }
  return m;
}

function malla(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Textura generada en un lienzo (sin archivos de imagen). */
function textura(ancho: number, alto: number, pintar: (c: CanvasRenderingContext2D) => void, repetir = 1): THREE.CanvasTexture {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  pintar(lienzo.getContext('2d')!);
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repetir, repetir);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

const texNieve = () =>
  textura(128, 128, (c) => {
    c.fillStyle = '#eef3f8';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#dfe7f0' : '#ffffff';
      c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
  }, 24);

const texCaja = () =>
  textura(64, 64, (c) => {
    c.fillStyle = '#a0703a';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#8a5e2e';
    for (let y = 0; y < 64; y += 16) c.fillRect(0, y, 64, 2);
    c.strokeStyle = '#5a3a1a';
    c.lineWidth = 6;
    c.strokeRect(3, 3, 58, 58);
    c.beginPath();
    c.moveTo(6, 6);
    c.lineTo(58, 58);
    c.moveTo(58, 6);
    c.lineTo(6, 58);
    c.lineWidth = 4;
    c.stroke();
  });

const texLadrillo = (base: string, junta: string) =>
  textura(64, 64, (c) => {
    c.fillStyle = junta;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = base;
    for (let f = 0; f < 8; f++) for (let k = -1; k < 4; k++) c.fillRect(k * 16 + (f % 2) * 8 + 1, f * 8 + 1, 14, 6);
  });

/** Apariencias de los equipos: antiterroristas (azul, casco) y terroristas (ropa de abrigo marrón). */
function lookSoldado(s: Soldado, propio: Look): Look {
  if (s.esJugador) return propio;
  const piel = LOOK_OPTIONS.skin[s.id % LOOK_OPTIONS.skin.length];
  if (s.equipo === 'ct') return { ...DEFAULT_LOOK, skin: piel, shirt: 0x1e3a6e, bottom: 'pants', bottomColor: 0x22303f, hat: 'helmet', hatColor: 0x2e3b4e, hair: 'short', accessory: s.id % 3 ? 'none' : 'sunglasses', facialHair: 'none' };
  return { ...DEFAULT_LOOK, skin: piel, shirt: [0x6d4c41, 0x5d6b3a, 0x4e342e][s.id % 3], bottom: 'pants', bottomColor: 0x3e3a33, hat: s.id % 2 ? 'beanie' : 'none', hatColor: 0x212121, hair: 'short', hairColor: 0x2b1d14, facialHair: s.id % 2 ? 'beard' : 'stubble', accessory: 'scarf' };
}

/** Arma que sostiene un soldado (en su mano derecha) o la vista en primera persona. */
function modeloArma(arma: Arma, primeraPersona: boolean): THREE.Group {
  const g = new THREE.Group();
  const metal = mat(0x2b2b2b);
  const madera = mat(0x7a4a24);
  const e = primeraPersona ? 1 : 0.6;
  switch (arma) {
    case 'rifle':
      g.add(malla(new THREE.BoxGeometry(0.07 * e, 0.09 * e, 0.6 * e), metal, 0, 0, -0.1 * e));
      g.add(malla(new THREE.BoxGeometry(0.06 * e, 0.12 * e, 0.22 * e), madera, 0, -0.02 * e, 0.28 * e));
      g.add(malla(new THREE.BoxGeometry(0.04 * e, 0.16 * e, 0.06 * e), metal, 0, -0.1 * e, -0.05 * e));
      g.add(malla(new THREE.CylinderGeometry(0.015 * e, 0.015 * e, 0.3 * e, 6), metal, 0, 0.02 * e, -0.5 * e).rotateX(Math.PI / 2));
      break;
    case 'francotirador':
      g.add(malla(new THREE.BoxGeometry(0.07 * e, 0.09 * e, 0.75 * e), mat(0x3b4a2a), 0, 0, -0.1 * e));
      g.add(malla(new THREE.CylinderGeometry(0.035 * e, 0.035 * e, 0.25 * e, 10), metal, 0, 0.08 * e, -0.05 * e).rotateX(Math.PI / 2));
      g.add(malla(new THREE.CylinderGeometry(0.015 * e, 0.015 * e, 0.4 * e, 6), metal, 0, 0.02 * e, -0.65 * e).rotateX(Math.PI / 2));
      break;
    case 'pistola':
      g.add(malla(new THREE.BoxGeometry(0.06 * e, 0.07 * e, 0.24 * e), mat(0x9e9e9e), 0, 0, -0.05 * e));
      g.add(malla(new THREE.BoxGeometry(0.05 * e, 0.13 * e, 0.06 * e), metal, 0, -0.08 * e, 0.04 * e));
      break;
    case 'm4':
      g.add(malla(new THREE.BoxGeometry(0.06 * e, 0.09 * e, 0.62 * e), metal, 0, 0, -0.1 * e));
      g.add(malla(new THREE.BoxGeometry(0.05 * e, 0.1 * e, 0.2 * e), mat(0x3a3a3a), 0, -0.01 * e, 0.3 * e));
      g.add(malla(new THREE.BoxGeometry(0.03 * e, 0.06 * e, 0.16 * e), metal, 0, 0.08 * e, -0.05 * e));
      g.add(malla(new THREE.BoxGeometry(0.04 * e, 0.14 * e, 0.05 * e), metal, 0, -0.1 * e, -0.08 * e));
      g.add(malla(new THREE.CylinderGeometry(0.014 * e, 0.014 * e, 0.28 * e, 6), metal, 0, 0.01 * e, -0.52 * e).rotateX(Math.PI / 2));
      break;
    case 'subfusil':
      g.add(malla(new THREE.BoxGeometry(0.07 * e, 0.1 * e, 0.42 * e), metal, 0, 0, -0.05 * e));
      g.add(malla(new THREE.BoxGeometry(0.035 * e, 0.16 * e, 0.05 * e), metal, 0, -0.11 * e, -0.12 * e));
      g.add(malla(new THREE.BoxGeometry(0.04 * e, 0.12 * e, 0.06 * e), metal, 0, -0.09 * e, 0.06 * e));
      break;
    case 'escopeta':
      g.add(malla(new THREE.CylinderGeometry(0.03 * e, 0.03 * e, 0.75 * e, 8), metal, 0, 0.02 * e, -0.18 * e).rotateX(Math.PI / 2));
      g.add(malla(new THREE.CylinderGeometry(0.035 * e, 0.035 * e, 0.3 * e, 8), madera, 0, -0.04 * e, -0.2 * e).rotateX(Math.PI / 2));
      g.add(malla(new THREE.BoxGeometry(0.06 * e, 0.12 * e, 0.26 * e), madera, 0, -0.03 * e, 0.24 * e));
      break;
    case 'glock':
      g.add(malla(new THREE.BoxGeometry(0.05 * e, 0.065 * e, 0.2 * e), mat(0x1e1e1e), 0, 0, -0.04 * e));
      g.add(malla(new THREE.BoxGeometry(0.045 * e, 0.12 * e, 0.055 * e), mat(0x1e1e1e), 0, -0.08 * e, 0.03 * e));
      break;
    case 'karambit': {
      const hoja = malla(new THREE.TorusGeometry(0.09 * e, 0.012 * e, 4, 12, Math.PI * 1.1), mat(0xcfd8dc), 0, 0.02 * e, -0.12 * e);
      hoja.rotation.y = Math.PI / 2;
      g.add(hoja, malla(new THREE.BoxGeometry(0.03 * e, 0.05 * e, 0.1 * e), mat(0x6a1b9a), 0, 0, 0.03 * e));
      g.add(malla(new THREE.TorusGeometry(0.025 * e, 0.008 * e, 4, 10), metal, 0, 0, 0.09 * e).rotateY(Math.PI / 2));
      break;
    }
    case 'machete':
      g.add(malla(new THREE.BoxGeometry(0.015 * e, 0.08 * e, 0.45 * e), mat(0xb0bec5), 0, 0.01 * e, -0.24 * e));
      g.add(malla(new THREE.BoxGeometry(0.035 * e, 0.05 * e, 0.13 * e), mat(0x3e2723), 0, 0, 0.06 * e));
      break;
    case 'cuchillo':
      g.add(malla(new THREE.BoxGeometry(0.02 * e, 0.05 * e, 0.24 * e), mat(0xcfd8dc), 0, 0, -0.12 * e));
      g.add(malla(new THREE.BoxGeometry(0.03 * e, 0.05 * e, 0.12 * e), metal, 0, 0, 0.06 * e));
      break;
  }
  return g;
}

interface ModeloSoldado {
  grupo: THREE.Group;
  cuerpo: THREE.Group;
  arma: Arma;
  fogonazo: THREE.Mesh;
}

export class Render3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly camara = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  private escena = new THREE.Scene();
  private modelos = new Map<Soldado, ModeloSoldado>();
  private lookActual = '';
  private vista = new THREE.Group();
  private armaVista: Arma | null = null;
  private fogonazoVista: THREE.Mesh;
  private luzFogonazo = new THREE.PointLight(0xffc870, 0, 6);
  private trazos: THREE.Mesh[] = [];
  private impactos: THREE.Mesh[] = [];
  private nieve: THREE.Points;
  private balanceo = 0;

  constructor(lienzo: HTMLCanvasElement, bloques: Bloque[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.escena.background = new THREE.Color(0xc9d6e3);
    this.escena.fog = new THREE.Fog(0xc9d6e3, 25, 95);

    this.escena.add(new THREE.HemisphereLight(0xf2f7ff, 0x8a9bb0, 1.4));
    const sol = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sol.position.set(20, 40, 15);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 1, far: 120 });
    this.escena.add(sol);

    this.construirMapa(bloques);

    // Nieve que cae alrededor de la cámara.
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.nieve = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.9, depthWrite: false }));
    this.escena.add(this.nieve);

    // Arma en primera persona, colgada de la cámara.
    this.vista.scale.setScalar(0.42);
    this.camara.add(this.vista);
    this.fogonazoVista = malla(new THREE.SphereGeometry(0.06, 8, 6), mat(0xffd27a, true), 0, 0.02, -0.75);
    this.fogonazoVista.castShadow = false;
    this.camara.add(this.fogonazoVista, this.luzFogonazo);
    this.luzFogonazo.position.set(0.2, -0.1, -0.8);
    this.escena.add(this.camara);
  }

  private construirMapa(bloques: Bloque[]) {
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(LIMITE_X * 2 + 40, LIMITE_Z * 2 + 40), new THREE.MeshLambertMaterial({ map: texNieve() }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    this.escena.add(suelo);

    const caja = new THREE.MeshLambertMaterial({ map: texCaja() });
    const ladrillo = new THREE.MeshLambertMaterial({ map: texLadrillo('#9a8f84', '#6f665d') });
    const piedra = new THREE.MeshLambertMaterial({ map: texLadrillo('#7d8590', '#5c636c') });
    const hormigon = new THREE.MeshLambertMaterial({ color: 0x9ea7ae });
    const nieve = mat(0xf7fbff);

    for (const bl of bloques) {
      const alto = bl.y1 - bl.y0;
      if (bl.tipo === 'arbol') {
        const x = bl.x;
        const z = bl.z;
        this.escena.add(malla(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 8), mat(0x5d4037), x, 0.8, z));
        for (let k = 0; k < 3; k++) {
          this.escena.add(malla(new THREE.ConeGeometry(1.6 - k * 0.4, 1.6, 9), mat(0x2e5d3a), x, 1.8 + k * 0.9, z));
          this.escena.add(malla(new THREE.ConeGeometry(1.0 - k * 0.25, 0.6, 9), nieve, x, 2.35 + k * 0.9, z));
        }
        continue;
      }
      const material = bl.tipo === 'caja' ? caja : bl.tipo === 'casa' ? ladrillo : bl.tipo === 'torre' ? hormigon : piedra;
      const geo = new THREE.BoxGeometry(bl.w, alto, bl.d);
      // Las texturas se repiten según el tamaño para no estirarse.
      if (bl.tipo !== 'caja') {
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) {
          const cara = Math.floor(i / 4);
          const u = cara < 2 ? bl.d : bl.w;
          const v = cara === 2 || cara === 3 ? bl.d : alto;
          uv.setXY(i, uv.getX(i) * u * 0.5, uv.getY(i) * v * 0.5);
        }
      }
      this.escena.add(malla(geo, material, bl.x, bl.y0 + alto / 2, bl.z));
      // Capa de nieve encima.
      if (bl.tipo !== 'casa' || alto < 1) this.escena.add(malla(new THREE.BoxGeometry(bl.w + 0.06, 0.08, bl.d + 0.06), nieve, bl.x, bl.y1 + 0.04, bl.z));
    }
    // Tejados de las casas (solo visuales) con nieve.
    for (const [x, z] of [[-14, 17], [14, 17], [-14, -17], [14, -17]]) {
      const techo = malla(new THREE.BoxGeometry(9, 0.3, 7), mat(0x5a4636), x, 3.35, z);
      this.escena.add(techo, malla(new THREE.BoxGeometry(9.1, 0.12, 7.1), nieve, x, 3.56, z));
    }
  }

  ajustar(ancho: number, alto: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  private modelo(s: Soldado, look: Look): ModeloSoldado {
    let m = this.modelos.get(s);
    if (!m) {
      const a = createAvatar(lookSoldado(s, look));
      const brazos = a.body.userData.arms as THREE.Object3D[];
      const arma = modeloArma(s.arma, false);
      arma.position.set(0, -0.38, 0.2);
      brazos[1].add(arma);
      brazos[1].rotation.x = -1.3;
      brazos[0].rotation.x = -1.1;
      brazos[0].rotation.z = -0.5;
      const fogonazo = malla(new THREE.SphereGeometry(0.07, 6, 4), mat(0xffd27a, true), 0, -0.36, 0.62);
      fogonazo.visible = false;
      brazos[1].add(fogonazo);
      m = { grupo: a.group, cuerpo: a.body, arma: s.arma, fogonazo };
      this.modelos.set(s, m);
      this.escena.add(a.group);
    }
    return m;
  }

  dibujar(p: Partida, look: Look, efectos: boolean, dt: number) {
    const clave = JSON.stringify(look);
    if (clave !== this.lookActual) {
      // El aspecto del jugador cambió: se rehace su modelo (lo ven los demás en las repeticiones).
      for (const [s, m] of this.modelos) if (s.esJugador) {
        this.escena.remove(m.grupo);
        this.modelos.delete(s);
      }
      this.lookActual = clave;
    }
    const vivos = new Set(p.soldados);
    for (const [s, m] of this.modelos) {
      if (!vivos.has(s)) {
        this.escena.remove(m.grupo);
        this.modelos.delete(s);
      }
    }

    // Cámara: ojos del jugador; si ha muerto, una vista elevada desde donde cayó.
    const j = p.jugador;
    if (j.vivo) {
      this.camara.position.set(j.cuerpo.x, j.cuerpo.y + ALTURA_OJOS, j.cuerpo.z);
      this.camara.rotation.set(j.pitch, j.yaw, 0, 'YXZ');
    } else {
      this.camara.position.set(j.cuerpo.x + 2, j.cuerpo.y + 4.5, j.cuerpo.z + 2);
      this.camara.lookAt(j.cuerpo.x, 0, j.cuerpo.z);
    }
    // Mira: zoom ligero con cualquier arma y ×4 con la telescópica de la AWP.
    const fov = p.zoom ? 75 / (ARMAS[j.arma].zoom ?? 1.4) : 75;
    if (this.camara.fov !== fov) {
      this.camara.fov = fov;
      this.camara.updateProjectionMatrix();
    }

    for (const s of p.soldados) {
      const m = this.modelo(s, look);
      m.grupo.visible = !s.esJugador || !s.vivo;
      if (!m.grupo.visible) continue;
      m.grupo.position.set(s.cuerpo.x, s.cuerpo.y, s.cuerpo.z);
      m.grupo.rotation.set(0, s.yaw + Math.PI, 0);
      if (s.vivo) {
        animateWalk(m.cuerpo, p.tiempo + s.id, s.moviendose);
        const brazos = m.cuerpo.userData.arms as THREE.Object3D[];
        brazos[1].rotation.x = -1.3 - s.pitch;
        brazos[0].rotation.x = -1.1 - s.pitch;
        m.fogonazo.visible = s.disparo < 0.05 && !esCuerpoACuerpo(s.arma);
      } else {
        // Cae de espaldas y se hunde en la nieve poco a poco.
        const k = Math.min(1, s.muerteT * 3);
        m.grupo.rotation.x = (-Math.PI / 2) * k;
        m.grupo.position.y = s.cuerpo.y + 0.15 * k - Math.max(0, s.muerteT - 3) * 0.3;
        m.fogonazo.visible = false;
      }
    }

    this.dibujarVista(p, dt);
    this.dibujarTrazos(p);

    this.nieve.visible = efectos;
    if (efectos) {
      const pos = this.nieve.geometry.attributes.position as THREE.BufferAttribute;
      const cx = this.camara.position.x;
      const cz = this.camara.position.z;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 1.4;
        let x = pos.getX(i) + Math.sin(p.tiempo + i) * dt * 0.3;
        let z = pos.getZ(i);
        // Los copos muy cerca de la cámara se verían como cuadrados enormes: vuelven arriba.
        if (y < 0 || (Math.abs(x - cx) < 1.5 && Math.abs(z - cz) < 1.5 && Math.abs(y - this.camara.position.y) < 1.5)) y += 25;
        if (x - cx > 30) x -= 60;
        if (cx - x > 30) x += 60;
        if (z - cz > 30) z -= 60;
        if (cz - z > 30) z += 60;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    this.renderer.render(this.escena, this.camara);
  }

  /** Arma en primera persona: balanceo al andar, retroceso, recarga y fogonazo. */
  private dibujarVista(p: Partida, dt: number) {
    const j = p.jugador;
    if (this.armaVista !== j.arma) {
      this.vista.clear();
      const arma = modeloArma(j.arma, true);
      const mano = malla(new THREE.SphereGeometry(0.06, 8, 6), mat(0xf5c9a0), 0, -0.08, 0.05);
      const manga = malla(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 8), mat(0x1e3a6e), 0.02, -0.12, 0.28);
      manga.rotation.x = Math.PI / 2.3;
      arma.add(mano, manga);
      this.vista.add(arma);
      this.armaVista = j.arma;
    }
    // Con la telescópica no se ve el arma; con la mira normal se centra (miras de hierro).
    const telescopica = p.zoom && !!ARMAS[j.arma].zoom;
    const ads = p.zoom && !telescopica;
    this.vista.visible = j.vivo && !telescopica;
    if (j.moviendose && j.cuerpo.enSuelo) this.balanceo += dt * 9;
    const recarga = j.recargando > 0 ? Math.sin(Math.min(1, j.recargando) * Math.PI) : 0;
    const golpe = Math.max(0, 1 - j.disparo * 10);
    const cuchillazo = esCuerpoACuerpo(j.arma) ? Math.max(0, 1 - j.disparo * 4) : 0;
    if (ads) this.vista.position.set(0, -0.085 - recarga * 0.1, -0.26 + golpe * 0.02);
    else this.vista.position.set(0.16 + Math.sin(this.balanceo) * 0.008, -0.15 + Math.abs(Math.cos(this.balanceo)) * 0.006 - recarga * 0.1, -0.32 + golpe * 0.03 - cuchillazo * 0.1);
    this.vista.rotation.set(golpe * 0.12 - recarga * 0.6, cuchillazo * 0.6, 0);
    const fog = j.disparo < 0.05 && !esCuerpoACuerpo(j.arma) && j.vivo;
    this.fogonazoVista.visible = fog && !telescopica;
    this.fogonazoVista.position.set(ads ? 0 : 0.16, ads ? -0.07 : -0.13, j.arma === 'pistola' || j.arma === 'glock' ? -0.47 : -0.62);
    this.luzFogonazo.intensity = fog ? 6 : 0;
  }

  private dibujarTrazos(p: Partida) {
    while (this.trazos.length < p.trazos.length) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), mat(0xfff2b0, true, 0.8));
      this.trazos.push(t);
      this.escena.add(t);
    }
    this.trazos.forEach((m, i) => {
      const t = p.trazos[i];
      m.visible = !!t;
      if (!t) return;
      const a = new THREE.Vector3(t.x0, t.y0, t.z0);
      const b = new THREE.Vector3(t.x1, t.y1, t.z1);
      // El trazo propio arranca un poco delante para no tapar la vista.
      if (t.propio) a.lerp(b, Math.min(0.5, 1.5 / a.distanceTo(b)));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.set(1, a.distanceTo(b), 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    });

    while (this.impactos.length < p.impactos.length) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0x333333, true));
      this.impactos.push(m);
      this.escena.add(m);
    }
    this.impactos.forEach((m, i) => {
      const imp = p.impactos[i];
      m.visible = !!imp;
      if (!imp) return;
      m.position.set(imp.x, imp.y, imp.z);
      m.material = imp.sangre ? mat(0xb71c1c, true) : mat(0x3a3a3a, true);
      m.scale.setScalar(imp.sangre ? 1.5 + (0.5 - imp.t) * 3 : 1);
    });
  }

  /** Proyecta un punto del mundo a la pantalla (para el radar y nombres). */
  proyectar(x: number, y: number, z: number, ancho: number, alto: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camara);
    return { x: ((v.x + 1) / 2) * ancho, y: ((1 - v.y) / 2) * alto, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }
}

export { Partida };
