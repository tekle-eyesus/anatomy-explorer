/**
 * renderer.js
 * CLICKABLE HEART + PLAY/PAUSE HEARTBEAT ANIMATION
 */

const canvas = document.getElementById("glCanvas");

/* =====================================
   Detect Organ From URL
===================================== */
const params = new URLSearchParams(window.location.search);
const selectedOrgan = params.get("organ") || "heart";

/* =====================================
   Scene
===================================== */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5);

/* =====================================
   Camera
===================================== */
const camera = new THREE.PerspectiveCamera(
  60,
  canvas.clientWidth / canvas.clientHeight,
  0.1,
  1000,
);

camera.position.set(0, 0, 5);

const orthoSize = 3;
const orthoCamera = new THREE.OrthographicCamera(
  (-orthoSize * canvas.clientWidth) / canvas.clientHeight,
  (orthoSize * canvas.clientWidth) / canvas.clientHeight,
  orthoSize,
  -orthoSize,
  0.1,
  1000,
);

orthoCamera.position.set(0, 0, 5);
orthoCamera.lookAt(0, 0, 0);
orthoCamera.zoom = 1;
orthoCamera.updateProjectionMatrix();

let activeCamera = camera;
let currentViewMode = "3d";

/* =====================================
   Renderer
===================================== */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);

/* =====================================
   Lights
===================================== */
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const light1 = new THREE.DirectionalLight(0xffffff, 1);
light1.position.set(5, 5, 5);
scene.add(light1);

const light2 = new THREE.DirectionalLight(0xffffff, 0.8);
light2.position.set(-5, 3, -5);
scene.add(light2);

/* =====================================
   Controls
===================================== */
let controls = createControls(activeCamera);

function createControls(targetCamera) {
  const c = new THREE.OrbitControls(targetCamera, renderer.domElement);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.target.set(0, 0, 0);

  if (currentViewMode === "2d") {
    c.enableRotate = false;
    c.enablePan = false;
  } else {
    c.enableRotate = true;
    c.enablePan = true;
  }

  return c;
}

function updateViewButtons() {
  const btn2d = document.getElementById("view-2d-btn");
  const btn3d = document.getElementById("view-3d-btn");

  if (!btn2d || !btn3d) {
    return;
  }

  btn2d.classList.toggle("active", currentViewMode === "2d");
  btn3d.classList.toggle("active", currentViewMode === "3d");
}

function setViewMode(mode) {
  if (mode !== "2d" && mode !== "3d") {
    return;
  }

  if (currentViewMode === mode) {
    return;
  }

  currentViewMode = mode;
  activeCamera = currentViewMode === "2d" ? orthoCamera : camera;

  controls.dispose();
  controls = createControls(activeCamera);

  if (currentViewMode === "2d") {
    orthoCamera.position.set(0, 0, 5);
    orthoCamera.lookAt(0, 0, 0);
  }

  updateViewButtons();
}

window.setViewMode = setViewMode;
updateViewButtons();

/* =====================================
   Variables
===================================== */
const loader = new THREE.GLTFLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();

let mixer = null;
let animationAction = null;
let animationPlaying = false;

let heartModel;
let clickableParts = [];
let selectedPart = null;

/* =====================================
   Add Play/Pause Buttons ONLY for Heart
===================================== */
if (selectedOrgan === "heart") {
  const controlsDiv = document.querySelector(".controls");

  controlsDiv.innerHTML += `
    <button class="btn view-toggle" onclick="playHeartAnimation()">▶</button>
    <button class="btn view-toggle" onclick="pauseHeartAnimation()">⏸</button>
  `;
}

// load the heart model
loader.load(
  "models/human_heart_3d_model_fbx_gltf.glb",

  function (gltf) {
    heartModel = gltf.scene;
    scene.add(heartModel);

    const box = new THREE.Box3().setFromObject(heartModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    /* scale first */
    const maxSize = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxSize;
    heartModel.scale.setScalar(scale);

    /* recompute box after scaling */
    const scaledBox = new THREE.Box3().setFromObject(heartModel);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    /* horizontal center */
    heartModel.position.x = -scaledCenter.x;

    /* vertical center FIX */
    heartModel.position.y = -scaledCenter.y;

    /* depth center */
    heartModel.position.z = -scaledCenter.z;

    /* OPTIONAL slight downward offset if needed */
    heartModel.position.y -= 0.15;

    /* =====================================
       Continue rest of your existing code
    ===================================== */

    heartModel.traverse((node) => {
      if (node.name && node.name.toLowerCase().includes("_jnt")) {
        clickableParts.push(node);
      }
    });

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(heartModel);
      animationAction = mixer.clipAction(gltf.animations[0]);
      animationAction.loop = THREE.LoopRepeat;
    }
  },
);

/* =====================================
   PLAY
===================================== */
function playHeartAnimation() {
  if (animationAction) {
    animationAction.play();
    animationPlaying = true;
  }
}

/* =====================================
   PAUSE
===================================== */
function pauseHeartAnimation() {
  if (animationAction) {
    animationAction.paused = true;
    animationPlaying = false;
  }
}

window.playHeartAnimation = playHeartAnimation;
window.pauseHeartAnimation = pauseHeartAnimation;

/* =====================================
   Click Detection
===================================== */
canvas.addEventListener("click", onClick);

function onClick(event) {
  const rect = canvas.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  let nearest = null;
  let nearestDistance = 99999;

  clickableParts.forEach((part) => {
    const pos = new THREE.Vector3();
    part.getWorldPosition(pos);

    const dist = raycaster.ray.distanceToPoint(pos);

    if (dist < 0.25 && dist < nearestDistance) {
      nearestDistance = dist;
      nearest = part;
    }
  });

  if (nearest) {
    updateInfoPanel(nearest.name);
    highlightPart(nearest);
  }
}

/* =====================================
   Highlight
===================================== */
function highlightPart(part) {
  if (selectedPart && selectedPart.helper) {
    scene.remove(selectedPart.helper);
  }

  const pos = new THREE.Vector3();
  part.getWorldPosition(pos);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffff00 }),
  );

  sphere.position.copy(pos);
  scene.add(sphere);

  part.helper = sphere;
  selectedPart = part;
}

/* =====================================
   Organ Data
===================================== */
const organData = {
  right_atrium_jnt6: {
    title: "Right Atrium",
    description: `
      <p>The right atrium is one of the four chambers of the heart. It is located on the upper right side of the heart and receives deoxygenated blood (blood that has delivered oxygen to the body) from two large veins: the superior vena cava (from the upper body) and the inferior vena cava (from the lower body). Once the right atrium fills with blood, it contracts and pushes the blood through the tricuspid valve into the right ventricle.</p>
      <ul>
        <li>The right atrium acts as a <strong>holding chamber</strong> for blood returning from the body before it enters the lower pumping chamber.</li>
        <li>Its inner wall has a rough, muscular ridge called the <em>pectinate muscles</em> that help with contraction.</li>
        <li>A small, ear‑like pouch called the <em>right atrial appendage</em> increases the atrium’s capacity to hold blood.</li>
        <li>In an adult, the right atrium receives about 4–5 liters of blood every minute when at rest.</li>
      </ul>
    `,
    funFact:
      "The right atrium has a small 'ear' called the auricle that can stretch to hold extra blood when your heart rate increases during exercise.",
    quizQuestion: {
      question:
        "Does the right atrium receive oxygen-rich blood from the lungs or oxygen-poor blood from the body?",
      answer: "Oxygen-poor (deoxygenated) blood from the body.",
    },
  },

  cardiac_muscle_jnt7: {
    title: "Cardiac Muscle (Myocardium)",
    description: `
      <p>Cardiac muscle, also called the myocardium, is the thick, middle layer of the heart wall. It is made of specialized muscle cells called cardiomyocytes that are striated (like skeletal muscle) but also connected by intercalated discs, which allow electrical signals to pass quickly from one cell to another. This unique structure enables the heart to contract in a coordinated, wave‑like pattern. The cardiac muscle never tires because it has a rich supply of blood from the coronary arteries and produces energy efficiently.</p>
      <ul>
        <li>Cardiac muscle cells are <strong>involuntary</strong> – you do not have to think about making your heart beat; the brain’s autonomic nervous system controls it.</li>
        <li>Each heartbeat begins with an electrical impulse from the <em>sinoatrial (SA) node</em>, often called the heart’s natural pacemaker.</li>
        <li>The myocardium is thickest in the left ventricle because that chamber must pump blood to the entire body.</li>
        <li>Unlike most other muscles, cardiac muscle cannot be consciously strengthened by exercise, but regular aerobic exercise makes it more efficient.</li>
      </ul>
    `,
    funFact:
      "Cardiac muscle cells are branched and connected end‑to‑end, forming a mesh that looks like a net. This helps the heart contract as one unit – like hundreds of people holding hands and squeezing together.",
    quizQuestion: {
      question:
        "Is cardiac muscle voluntary (you control it) or involuntary (it works automatically)?",
      answer:
        "Involuntary – your brain controls it automatically without you having to think about it.",
    },
  },

  right_pulmonary_valve_jnt9: {
    title: "Right Cusp of the Pulmonary Valve",
    description: `
      <p>The pulmonary valve is located between the right ventricle and the pulmonary artery. It consists of three crescent‑shaped flaps (cusps): right, left, and anterior. This part represents the <strong>right cusp</strong>. When the right ventricle contracts, the pulmonary valve opens to allow deoxygenated blood to flow into the pulmonary trunk and then to the lungs. When the ventricle relaxes, the cusps fill with blood and snap shut, preventing backward flow. The three cusps work together like a one‑way door.</p>
      <ul>
        <li>The pulmonary valve is one of the two <em>semilunar valves</em> (the other is the aortic valve) – “semilunar” means half‑moon, describing the shape of each cusp.</li>
        <li>During each heartbeat, the pulmonary valve opens for about 0.1 to 0.15 seconds to let blood through.</li>
        <li>If a cusp does not close properly, a condition called <em>pulmonary regurgitation</em> can occur, where some blood leaks back into the right ventricle.</li>
        <li>Unlike the mitral and tricuspid valves, the pulmonary valve has no chordae tendineae (heart strings) holding it; it relies on blood pressure and the shape of the cusps.</li>
      </ul>
    `,
    funFact:
      "The three cusps of the pulmonary valve are named after their positions – right, left, and anterior (front). But their shapes are almost identical, like three matching half‑moons!",
    quizQuestion: {
      question:
        "Does the pulmonary valve open to let blood flow from the right ventricle to the lungs, or from the lungs back to the heart?",
      answer: "From the right ventricle to the lungs.",
    },
  },

  left_pulmonary_valve_jnt11: {
    title: "Left Cusp of the Pulmonary Valve",
    description: `
      <p>The left cusp is the second of three flaps that form the pulmonary valve. It sits on the left side of the pulmonary opening. Together with the right and anterior cusps, it ensures that blood pumped from the right ventricle moves only forward into the pulmonary circulation. The left cusp is slightly thinner than the right cusp in some individuals, but all three cusps are designed to withstand the pressure changes of each heartbeat. Their free edges meet at the center when the valve closes, creating a tight seal.</p>
      <ul>
        <li>The three cusps of the pulmonary valve are named by their position: left, right, and anterior (facing the front of the chest).</li>
        <li>Each cusp has a small nodule (called the <em>nodulus of Arantius</em>) at its center that helps create a perfect seal when the valve closes.</li>
        <li>Blood passing through the pulmonary valve is dark red because it carries carbon dioxide – it turns bright red only after picking up oxygen in the lungs.</li>
        <li>In a resting adult, about 5 liters of blood pass through the pulmonary valve every minute.</li>
      </ul>
    `,
    funFact:
      "The left cusp of the pulmonary valve is sometimes called the 'left semilunar cusp' – and 'semilunar' means half‑moon. If you look at it from above, it really does look like a crescent moon!",
    quizQuestion: {
      question:
        "What color is the blood that goes through the left cusp of the pulmonary valve – bright red or dark red?",
      answer:
        "Dark red, because it still has carbon dioxide and hasn't reached the lungs yet.",
    },
  },

  left_atrium_jnt13: {
    title: "Left Atrium",
    description: `
      <p>The left atrium is located on the upper left side of the heart. Unlike the right atrium, which receives deoxygenated blood, the left atrium receives <strong>oxygenated blood</strong> from the lungs through four pulmonary veins. After filling, the left atrium contracts and pushes blood through the mitral valve into the left ventricle, which then pumps it to the rest of the body. The walls of the left atrium are slightly thicker than those of the right atrium because they have to push blood against higher pressure from the left ventricle.</p>
      <ul>
        <li>The left atrium acts as a <em>low‑pressure reservoir</em> that stores blood while the left ventricle is contracting and then releases it when the ventricle relaxes.</li>
        <li>It has a smooth inner surface except for the left atrial appendage, which contains pectinate muscles similar to those in the right atrium.</li>
        <li>The left atrium is also involved in regulating blood volume by releasing <em>atrial natriuretic peptide (ANP)</em>, a hormone that tells the kidneys to remove more salt and water, lowering blood pressure.</li>
        <li>Arrhythmias like <em>atrial fibrillation</em> often start in the left atrium, especially near the openings of the pulmonary veins.</li>
      </ul>
    `,
    funFact:
      "The left atrium receives blood that is bright red because it just picked up fresh oxygen from your lungs. That's why in diagrams, the left side of the heart is usually colored red!",
    quizQuestion: {
      question:
        "Does the left atrium receive oxygenated (oxygen‑rich) blood or deoxygenated (oxygen‑poor) blood?",
      answer: "Oxygenated (oxygen‑rich) blood from the lungs.",
    },
  },

  left_atrium_storage_jnt14: {
    title: "Left Atrial Appendage (Storage Pouch)",
    description: `
      <p>The left atrial appendage (LAA) is a small, finger‑like pouch that extends from the left atrium. It is a remnant of the embryonic heart and can vary in size and shape (often described as a wind‑sock or a small ear). Although it was once thought to be a useless structure, we now know that it serves as a <strong>storage chamber</strong> that helps regulate blood volume and pressure. The LAA has muscular ridges inside (pectinate muscles) that allow it to expand and contract more than the smooth part of the left atrium.</p>
      <ul>
        <li>The left atrial appendage can hold up to 10–15% of the total blood volume of the left atrium when the heart is relaxed.</li>
        <li>It releases <em>atrial natriuretic peptide (ANP)</em> in larger amounts than the rest of the atrium, helping to control salt and water balance in the body.</li>
        <li>In people with atrial fibrillation, blood can pool in the LAA and form clots; therefore, sometimes doctors close off the LAA to prevent strokes.</li>
        <li>Unlike the right atrial appendage, which is blunt and triangular, the left atrial appendage is longer and more narrow, with a characteristic hook shape.</li>
      </ul>
    `,
    funFact:
      "The left atrial appendage is so variable that no two people have exactly the same shape – some are long and skinny, others short and wide, and a few have multiple lobes like a tiny hand!",
    quizQuestion: {
      question:
        "What is one important job of the left atrial appendage besides holding extra blood?",
      answer:
        "It releases a hormone (atrial natriuretic peptide) that helps control salt and water balance in the body.",
    },
  },

  left_mitral_valve_jnt15: {
    title: "Left Leaflet of the Mitral Valve (Anterior Cusp)",
    description: `
      <p>The mitral valve is located between the left atrium and the left ventricle. It has two flaps (leaflets): the anterior (left) leaflet and the posterior (right) leaflet. This part represents the <strong>anterior leaflet</strong>. The anterior leaflet is larger and more mobile than the posterior leaflet. When the left atrium contracts, blood flows between the two leaflets into the ventricle. When the ventricle contracts, the leaflets close together to prevent blood from leaking back into the atrium. The anterior leaflet is attached to papillary muscles in the ventricle via chordae tendineae (tough, string‑like tendons).</p>
      <ul>
        <li>Normal mitral valve area is about 4–6 cm²; the anterior leaflet covers roughly two‑thirds of that opening.</li>
        <li>The anterior leaflet is sometimes called the <em>aortic leaflet</em> because it is continuous with the aortic valve’s fibrous structure.</li>
        <li>During a heartbeat, the anterior leaflet moves like a swinging door; its smooth motion is essential for the valve to close completely.</li>
        <li>Mitral valve prolapse – a condition where the leaflets bulge backward – most often affects the anterior leaflet.</li>
      </ul>
    `,
    funFact:
      "The anterior leaflet of the mitral valve is shaped like a sail. When the ventricle contracts, it billows upward to meet the posterior leaflet – just like two sails coming together to block the wind!",
    quizQuestion: {
      question:
        "What structure attaches the anterior leaflet of the mitral valve to the ventricle wall to keep it from flipping backward?",
      answer: "Chordae tendineae (tough, string‑like tendons).",
    },
  },

  right_mitral_valve_jnt16: {
    title: "Right Leaflet of the Mitral Valve (Posterior Cusp)",
    description: `
      <p>The posterior leaflet (right leaflet) of the mitral valve is the second of the two flaps that make up the mitral valve. It is smaller and shorter than the anterior leaflet, and it is often divided into three scallops (indentations) – lateral, middle, and medial. The posterior leaflet attaches to the inner wall of the left ventricle and is also anchored by chordae tendineae to the papillary muscles. While the anterior leaflet does most of the moving, the posterior leaflet provides a stable backstop that helps create a watertight seal when the valve closes.</p>
      <ul>
        <li>The posterior leaflet is sometimes called the <em>mural leaflet</em> because it is attached to the wall (murus in Latin) of the ventricle.</li>
        <li>In the closed position, the posterior leaflet supports about one‑third of the sealing surface; the anterior leaflet covers the rest.</li>
        <li>Mitral regurgitation (leaky valve) is more often due to problems of the posterior leaflet, such as flail or prolapse of one of its scallops.</li>
        <li>Because the posterior leaflet is less mobile than the anterior leaflet, it is often targeted for surgical repair using techniques like a “posterior leaflet sliding plasty.”</li>
      </ul>
    `,
    funFact:
      "The posterior leaflet of the mitral valve often has three natural indentations that make it look like a three‑leaf clover. Doctors call these indentations 'scallops' – just like the edges of a scallop shell!",
    quizQuestion: {
      question:
        "Which is larger – the anterior (left) leaflet of the mitral valve or the posterior (right) leaflet?",
      answer: "The anterior leaflet is larger.",
    },
  },

  aortic_valve_02_jnt17: {
    title: "Aortic Valve – Right Coronary Cusp (Cusp 2)",
    description: `
      <p>The aortic valve sits between the left ventricle and the aorta, the largest artery in the body. Like the pulmonary valve, it has three semilunar cusps: the left coronary cusp, the right coronary cusp (this part), and the non‑coronary cusp. The right coronary cusp is named because the right coronary artery originates from a small opening just above this cusp. When the left ventricle contracts, the aortic valve opens and oxygenated blood rushes into the aorta. When the ventricle relaxes, the cusps fill with blood and snap closed, preventing backflow.</p>
      <ul>
        <li>Each cusp of the aortic valve has a small fibrous nodule (the <em>nodulus of Arantius</em>) that helps seal the center, and thin side‑lunules that make the seal even tighter.</li>
        <li>The right coronary cusp is the most common site for aortic valve calcification (hardening) in older adults, which can narrow the valve (aortic stenosis).</li>
        <li>Blood pressure in the aorta is much higher than in the pulmonary artery, so the aortic valve is thicker and stronger than the pulmonary valve.</li>
        <li>When this cusp fails to open fully, the left ventricle must work much harder to pump blood out – a condition that can eventually lead to heart failure if untreated.</li>
      </ul>
    `,
    funFact:
      "The right coronary cusp of the aortic valve has a tiny opening just above it that leads to the right coronary artery – the blood vessel that feeds the right side of the heart muscle. That's why it's called the 'right coronary cusp'!",
    quizQuestion: {
      question:
        "What is the name of the largest artery that the aortic valve opens into?",
      answer: "The aorta.",
    },
  },

  aortic_valve_03_jnt19: {
    title: "Aortic Valve – Non‑Coronary Cusp (Cusp 3)",
    description: `
      <p>The non‑coronary cusp is the third flap of the aortic valve, so named because no coronary artery originates from its associated sinus (pouch). It sits on the posterior side of the aortic root, opposite the right coronary cusp. Like the other two cusps, it opens to allow blood to leave the heart and closes to prevent backflow. The non‑coronary cusp is the largest of the three cusps in some individuals and is in close contact with the membranous part of the heart’s septum (the wall between the ventricles).</p>
      <ul>
        <li>Because the non‑coronary cusp has no artery branching from its sinus, it is sometimes the preferred site for certain heart surgeries, such as aortic valve repair or replacing the valve with a prosthetic.</li>
        <li>Infective endocarditis (bacterial infection of the heart valves) most commonly affects the non‑coronary cusp after the mitral valve.</li>
        <li>During each heartbeat, the non‑coronary cusp experiences forces up to 5 times the normal blood pressure in the aorta, yet it can function for decades without damage.</li>
        <li>Unlike the mitral and tricuspid valves, the aortic valve has no chordae tendineae; its cusps are flexible but held in place by the fibrous skeleton of the heart.</li>
      </ul>
    `,
    funFact:
      "The non‑coronary cusp is the only one of the three aortic valve cusps that does NOT have a coronary artery above it. That's why doctors sometimes choose it as the best place to make a small cut during heart surgery – no important blood vessels in the way!",
    quizQuestion: {
      question: "How many cusps (flaps) does the aortic valve have?",
      answer:
        "Three cusps – the left coronary, right coronary, and non‑coronary.",
    },
  },

  aortic_valve_01_jnt21: {
    title: "Aortic Valve – Left Coronary Cusp (Cusp 1)",
    description: `
      <p>The left coronary cusp is the first of the three aortic valve cusps. It is named because the left main coronary artery (which supplies blood to the front and side of the heart) arises from a small opening in the aorta just above this cusp. The left coronary cusp is positioned on the left side of the aortic root, between the right coronary cusp and the non‑coronary cusp. Together with the other two cusps, it creates a one‑way valve that ensures blood flows from the left ventricle into the aorta and then to the entire body.</p>
      <ul>
        <li>The left coronary cusp is slightly smaller than the non‑coronary cusp but larger than the right coronary cusp in many people.</li>
        <li>Inside the sinus behind this cusp (Valsalva sinus), swirling blood helps the valve close efficiently and also provides a resting area for the left coronary artery opening.</li>
        <li>If this cusp becomes stiff or calcified, it can reduce blood flow to the heart muscle through the left coronary artery, causing chest pain (angina).</li>
        <li>During intense exercise, the left coronary cusp may open and close more than 150,000 times per day, each time withstanding pressures of 120 mmHg or more.</li>
      </ul>
    `,
    funFact:
      "The left coronary cusp is nicknamed the 'widowmaker' cusp by some doctors – not because of the cusp itself, but because the left main coronary artery above it, if blocked, causes a very dangerous heart attack.",
    quizQuestion: {
      question:
        "What important blood vessel comes out of the aorta just above the left coronary cusp?",
      answer:
        "The left main coronary artery (which supplies blood to the front and side of the heart).",
    },
  },

  left_tricuspid_valve_jnt23: {
    title: "Tricuspid Valve – Left (Septal) Leaflet",
    description: `
      <p>The tricuspid valve is the valve between the right atrium and the right ventricle. It normally has three leaflets: anterior (front), posterior (back), and septal (attached to the septum, the wall between the ventricles). This part represents the <strong>septal (left) leaflet</strong>. The septal leaflet is the smallest of the three and is attached directly to the muscular wall that separates the two ventricles. It prevents blood from leaking back into the right atrium when the right ventricle contracts.</p>
      <ul>
        <li>The septal leaflet of the tricuspid valve has a distinctive semi‑circular shape and is attached to the interventricular septum via several small chordae tendineae.</li>
        <li>This leaflet is often the site of <em>Ebstein’s anomaly</em>, a rare birth defect where the septal leaflet is displaced downward into the right ventricle, causing the valve to leak.</li>
        <li>Because the right side of the heart works at lower pressure, the tricuspid valve is thinner and more delicate than the mitral valve.</li>
        <li>The septal leaflet is sometimes used as a landmark during heart surgery because it lies close to the heart’s electrical conduction system (the bundle of His).</li>
      </ul>
    `,
    funFact:
      "The septal leaflet of the tricuspid valve is the only heart valve leaflet that attaches directly to the wall (septum) between the two ventricles – making it a true 'wallflower' of the heart!",
    quizQuestion: {
      question:
        "How many leaflets does the tricuspid valve normally have – two, three, or four?",
      answer: "Three leaflets – that's why it's called 'tri' cuspid.",
    },
  },

  right_tricuspid_valve_jnt24: {
    title: "Tricuspid Valve – Right (Anterior) Leaflet",
    description: `
      <p>The anterior leaflet (right leaflet) of the tricuspid valve is the largest and most mobile of the three tricuspid valve leaflets. It attaches to the free wall of the right ventricle, opposite the septal leaflet. During contraction of the right atrium, this leaflet swings open to allow blood to pass into the right ventricle. Then, when the right ventricle squeezes, the anterior leaflet rises to meet the other two leaflets, completely sealing the valve opening. The anterior leaflet is supported by strong chordae tendineae that connect to the anterior papillary muscle of the right ventricle.</p>
      <ul>
        <li>The anterior leaflet often has a rough, scalloped edge that helps create a more effective seal compared to the smooth edges of the other leaflets.</li>
        <li>In a condition called <em>tricuspid regurgitation</em>, the anterior leaflet is most often involved because it is the largest and experiences the greatest mechanical stress.</li>
        <li>Because it is larger, the anterior leaflet is the preferred target for surgical tricuspid valve repair using a technique called annuloplasty (tightening the ring around the valve).</li>
        <li>During fetal development, the anterior leaflet forms earlier than the other two leaflets, appearing by the 8th week of pregnancy.</li>
      </ul>
    `,
    funFact:
      "The anterior leaflet of the tricuspid valve is so large that it covers almost half of the valve opening all by itself. When the heart beats, this leaflet does most of the heavy lifting to close the valve tightly!",
    quizQuestion: {
      question:
        "Which leaflet of the tricuspid valve is the largest and most movable – the septal (left), posterior, or anterior (right)?",
      answer: "The anterior (right) leaflet.",
    },
  },
};
/* =====================================
   Update Panel
===================================== */
function updateInfoPanel(name) {
  const title = document.getElementById("organ-title");
  const desc = document.getElementById("part-description");

  const data = organData[name];

  if (!data) {
    title.innerHTML = name;
    desc.innerHTML = `
      <div class="info-card">
        <p>Information for this part is coming soon.</p>
      </div>
    `;
    return;
  }

  title.innerHTML = data.title;

  desc.innerHTML = `
    <div class="fade-in">

      <div class="section-card">
        <h3>Description</h3>
        ${data.description}
      </div>

      <div class="section-card fact-card">
        <h3>Fun Fact</h3>
        <p class="fact-text">${data.funFact}</p>
      </div>

      <div class="section-card quiz-card">
        <h3>Quick Quiz</h3>
        <p><strong>${data.quizQuestion.question}</strong></p>

        <button class="quiz-btn" onclick="showAnswer('${name}')">
          Show Answer
        </button>

        <div id="quiz-answer"></div>
      </div>

    </div>
  `;
}

function showAnswer(name) {
  const answerBox = document.getElementById("quiz-answer");

  answerBox.innerHTML = `
    <div class="answer-box">
      ${organData[name].quizQuestion.answer}
    </div>
  `;
}
window.showAnswer = showAnswer;

/* =====================================
   Zoom
===================================== */
function adjustZoom(v) {
  if (currentViewMode === "2d") {
    orthoCamera.zoom = THREE.MathUtils.clamp(orthoCamera.zoom * v, 0.5, 6);
    orthoCamera.updateProjectionMatrix();
    return;
  }

  camera.position.multiplyScalar(1 / v);
}

window.adjustZoom = adjustZoom;

/* =====================================
   Resize
===================================== */
window.addEventListener("resize", () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  orthoCamera.left = (-orthoSize * w) / h;
  orthoCamera.right = (orthoSize * w) / h;
  orthoCamera.top = orthoSize;
  orthoCamera.bottom = -orthoSize;
  orthoCamera.updateProjectionMatrix();

  renderer.setSize(w, h);
});

/* =====================================
   Animate
===================================== */
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer && animationPlaying) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, activeCamera);
}

animate();
