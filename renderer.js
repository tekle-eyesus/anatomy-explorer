const canvas = document.getElementById("glCanvas");

// multilingual support (English and Amharic for now)
let currentLang = localStorage.getItem("preferredLanguage") || "en";

function isAmharic() {
  return currentLang === "am";
}

// get organ url parameter to decide which organ model to load and show
const params = new URLSearchParams(window.location.search);
const selectedOrgan = params.get("organ") || "heart";

// Scene Creation using Three.js library
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5);

//    Camera
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
   Variables used throughout the code for loading models, raycasting, animation, and interaction
===================================== */
const loader = new THREE.GLTFLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();

let mixer = null;
let animationAction = null;
let animationPlaying = false;

let heartModel;
let kidneyModel;
let clickableParts = [];
let selectedPart = null;

/* =====================================
   Add Play/Pause Buttons ONLY for Heart
===================================== */
if (selectedOrgan === "heart") {
  const controlsDiv = document.querySelector(".controls");

  controlsDiv.innerHTML += `
    <button id="heart-animation-btn" class="btn view-toggle" onclick="toggleHeartAnimation()">▶</button>
  `;
}

function centerAndScaleModel(model, targetSize = 3, yOffset = 0) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  const maxSize = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxSize;
  model.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  model.position.x = -scaledCenter.x;
  model.position.y = -scaledCenter.y + yOffset;
  model.position.z = -scaledCenter.z;
}

// loading the heart model
function loadHeartModel() {
  loader.load("models/heart.glb", function (gltf) {
    heartModel = gltf.scene;
    scene.add(heartModel);
    centerAndScaleModel(heartModel, 3, -0.15);

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
  });
}

// loading the kidney model
function loadKidneyModel() {
  loader.load("models/kidney.glb", function (gltf) {
    kidneyModel = gltf.scene;
    scene.add(kidneyModel);

    centerAndScaleModel(kidneyModel, 3, 0);

    clickableParts = [];

    kidneyModel.traverse((node) => {
      if (node.isMesh) {
        console.log(node.name);

        if (kidneyOrganData[node.name]) {
          clickableParts.push(node);
        }
      }
    });
  });
}

if (selectedOrgan === "kidneys") {
  loadKidneyModel();
} else {
  loadHeartModel();
}

// Heart beat animation loop controls (play/pause) //
function updateHeartAnimationButton() {
  const button = document.getElementById("heart-animation-btn");

  if (!button) {
    return;
  }

  button.textContent = animationPlaying ? "⏸" : "▶";
}

// Toggle play/pause state of the heart beat animation when the button is clicked
function toggleHeartAnimation() {
  if (!animationAction) {
    return;
  }

  if (animationPlaying) {
    animationAction.paused = true;
    animationPlaying = false;
  } else {
    animationAction.paused = false;
    animationAction.play();
    animationPlaying = true;
  }

  updateHeartAnimationButton();
}

function playHeartAnimation() {
  if (!animationAction) {
    return;
  }

  animationAction.paused = false;
  animationAction.play();
  animationPlaying = true;
  updateHeartAnimationButton();
}

function pauseHeartAnimation() {
  if (!animationAction) {
    return;
  }

  animationAction.paused = true;
  animationPlaying = false;
  updateHeartAnimationButton();
}

updateHeartAnimationButton();

window.playHeartAnimation = playHeartAnimation;
window.pauseHeartAnimation = pauseHeartAnimation;
window.toggleHeartAnimation = toggleHeartAnimation;

// Click Interaction for each organ parts
canvas.addEventListener("click", onClick);

function onClick(event) {
  const rect = canvas.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, activeCamera);

  if (selectedOrgan === "kidneys") {
    const hits = raycaster.intersectObjects(clickableParts, true);

    if (hits.length > 0) {
      const clicked = hits[0].object;

      updateInfoPanel(clicked.name);
      highlightMesh(clicked);
    }

    return;
  }

  // HEART OLD LOGIC
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

// Highlight Selected Part
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

// Highlight the selected meshes support
function highlightMesh(mesh) {
  if (selectedPart && selectedPart.materialBackup) {
    selectedPart.material.emissive.setHex(0x000000);
  }

  if (mesh.material && mesh.material.emissive) {
    mesh.materialBackup = true;
    mesh.material.emissive.setHex(0xffff00);
  }

  selectedPart = mesh;
}

// DATA USED

// Some overview infromation about each organ to show when the organ is first loaded (before any part is clicked)
let organOverview = {
  heart: {
    en: {
      title: "Human Heart",
      summary: `
        <p>The heart is a muscular organ that pumps blood through the blood vessels of the circulatory system. It has four chambers two atria and two ventricles and supports both pulmonary and systemic circulation. The heart’s coordinated contractions are driven by electrical signals originating in the sinoatrial node.</p>
        <ul>
          <li>Pumps about 5 liters of blood per minute at rest.</li>
          <li>Has four main valves: tricuspid, pulmonary, mitral, and aortic.</li>
          <li>Supplied by the coronary arteries that run along its surface.</li>
        </ul>
      `,
      more: `Click any heart part to learn about it.`,
    },
    am: {
      title: "የሰው ልብ",
      summary: `
        <p>ልብ በደም ዝውውር ሥርዓት ውስጥ ደምን በደም ሥሮች ውስጥ የሚረጭ ጡንቻማ አካል ነው። አራት ክፍሎች (ሁለት አትሪያ እና ሁለት ቬንትሪክል) ያሉት ሲሆን የሳንባ እና የሰውነት የደም ዝውውርን ይደግፋል። የልብ የተቀናጀ ምት የሚመነጨው በሲኖአትሪያል ኖድ ውስጥ ከሚፈጠሩ የኤሌክትሪክ ምልክቶች ነው።</p>
        <ul>
          <li>በእረፍት ጊዜ በደቂቃ 5 ሊትር ያህል ደም ይረጫል።</li>
          <li>አራት ዋና ዋና ቫልቮች አሉት፡ ትራይከስፒድ፣ ፐልሞነሪ፣ ሚትራል እና አኦርቲክ።</li>
          <li>በላዩ ላይ በሚሄዱት የኮሮናሪ ደም ወሳጅ ቧንቧዎች አማካኝነት ደም ያገኛል።</li>
        </ul>
      `,
      more: `ለማወቅ ማንኛውንም የልብ ክፍል ጠቅ ያድርጉ።`,
    },
  },
  lungs: {
    en: {
      title: "Human Lungs",
      summary: `
        <p>The lungs are the primary organs of respiration. They exchange oxygen and carbon dioxide between the air and blood via tiny air sacs called alveoli. The diaphragm and intercostal muscles drive breathing.</p>
        <ul>
          <li>Right lung has three lobes, left lung has two lobes.</li>
          <li>Alveoli provide a large surface area for gas exchange.</li>
          <li>Air travels through bronchi and bronchioles to reach alveoli.</li>
        </ul>
      `,
      more: `Click any lung structure to learn about it.`,
    },
    am: {
      title: "የሰው ሳንባ",
      summary: `
        <p>ሳንባዎች ዋነኛው የመተንፈሻ አካላት ናቸው። አልቪዮሊ በሚባሉ ጥቃቅን የአየር ከረጢቶች አማካኝነት በአየር እና በደም መካከል ኦክስጅንን እና ካርቦን ዳይኦክሳይድን ይለዋወጣሉ። ዲያፍራም እና የጎድን አጥንት ጡንቻዎች አተነፋፈስን ያንቀሳቅሳሉ።</p>
        <ul>
          <li>ቀኝ ሳንባ ሶስት ክፍሎች (lobes) ሲኖሩት፣ ግራ ሳንባ ሁለት ክፍሎች አሉት።</li>
          <li>አልቪዮሊ ለጋዝ ልውውጥ ሰፊ ቦታን ይሰጣሉ።</li>
          <li>አየር በአልቪዮሊ ለመድረስ በብሮንካይ እና በብሮንካይተስ በኩል ይጓዛል።</li>
        </ul>
      `,
      more: `ለማወቅ ማንኛውንም የሳንባ ክፍል ጠቅ ያድርጉ።`,
    },
  },
  kidneys: {
    en: {
      title: "Human Kidney",
      summary: `
        <p>The kidneys are two bean-shaped organs that filter waste from the blood, regulate fluid balance, and help control blood pressure. They produce urine by removing excess water, salts, and metabolic waste while keeping useful substances in the body.</p>
        <ul>
          <li>Each kidney contains around one million tiny filtering units called nephrons.</li>
          <li>The kidneys help balance electrolytes such as sodium and potassium.</li>
          <li>They also release hormones that support red blood cell production and blood pressure control.</li>
        </ul>
      `,
      more: `Click any kidney part to learn about it.`,
    },
    am: {
      title: "የሰው ኩላሊት",
      summary: `
        <p>ኩላሊቶች ከደም ውስጥ ቆሻሻን የሚያጣሩ፣ የፈሳሽ መጠንን የሚቆጣጠሩ እና የደም ግፊትን ለመቆጣጠር የሚረዱ ሁለት የባቄላ ቅርጽ ያላቸው አካላት ናቸው። ጠቃሚ ነገሮችን በሰውነት ውስጥ በማቆየት፣ ከመጠን በላይ ውሃን፣ ጨውና ሜታቦሊክ ቆሻሻን በማስወገድ ሽንትን ያመነጫሉ።</p>
        <ul>
          <li>እያንዳንዱ ኩላሊት ኔፍሮን የሚባሉ ወደ አንድ ሚሊዮን የሚጠጉ ጥቃቅን የማጣሪያ ክፍሎችን ይዟል።</li>
          <li>ኩላሊቶች እንደ ሶዲየም እና ፖታሲየም ያሉ ኤሌክትሮላይቶችን ለማመጣጠን ይረዳሉ።</li>
          <li>እንዲሁም የቀይ የደም ሴል ምርትን እና የደም ግፊትን የሚረዱ ሆርሞኖችን ይለቃሉ።</li>
        </ul>
      `,
      more: `ለማወቅ ማንኛውንም የኩላሊት ክፍል ጠቅ ያድርጉ።`,
    },
  },
};

// function to show overview information about the organ when it is first loaded
function showOrganOverview(organId) {
  const title = document.getElementById("organ-title");
  const desc = document.getElementById("part-description");

  const organ = organOverview[organId] || organOverview.heart;
  const data = isAmharic() ? organ.am : organ.en;

  title.innerHTML = data.title;
  document.title = `Organ Explorer | ${data.title}`;

  desc.innerHTML = `
    <div class="fade-in">
      <div class="section-card">
        <h3>Overview</h3>
        ${data.summary}
      </div>

      <div class="section-card fact-card">
        <h3>Tip</h3>
        <p class="fact-text">${data.more}</p>
      </div>

      <div class="section-card">
        <h3>Quick Hint</h3>
        <p>Tap any highlighted/interactive part on the model to see focused information about that part.</p>
      </div>
    </div>
  `;
}

// Heart organ data with localization support (English/amharic)
let organData = {
  right_atrium_jnt6: {
    en: {
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
    am: {
      title: "ቀኝ አትሪየም (Right Atrium)",
      description: `
        <p>ቀኝ አትሪየም ከአራቱ የልብ ክፍሎች አንዱ ነው። በልብ የላይኛው ቀኝ በኩል የሚገኝ ሲሆን ኦክስጅን የሌለውን (ለሰውነት ኦክስጅን አድርሶ የተመለሰ) ደም ከሁለት ትላልቅ የደም ሥሮች ይቀበላል፡ እነሱም የላይኛው ቬና ካቫ (ከላይኛው የሰውነት ክፍል) እና የታችኛው ቬና ካቫ (ከታችኛው የሰውነት ክፍል) ናቸው። ቀኝ አትሪየም በደም ሲሞላ፣ ተኮማትሮ ደሙን በትራይከስፒድ ቫልቭ በኩል ወደ ቀኝ ቬንትሪክል ይገፋዋል።</p>
        <ul>
          <li>ቀኝ አትሪየም ደም ወደ ታችኛው መርጫ ክፍል ከመግባቱ በፊት እንደ <strong>ጊዜያዊ ማከማቻ</strong> ያገለግላል።</li>
          <li>የውስጥ ግድግዳው ፔክቲኔት (pectinate) የሚባሉ ለኮንትራክሽን የሚረዱ ሸካራ ጡንቻዎች አሉት።</li>
          <li>"ቀኝ አትሪያል አፔንዴጅ" የሚባል ትንሽ ጆሮ መሰል ከረጢት አትሪየሙ ብዙ ደም እንዲይዝ ይረዳዋል።</li>
          <li>አንድ አዋቂ ሰው በእረፍት ላይ እያለ ቀኝ አትሪየም በደቂቃ ከ4–5 ሊትር ደም ይቀበላል።</li>
        </ul>
      `,
      funFact:
        "ቀኝ አትሪየም 'ኦሪክል' የሚባል ትንሽ ጆሮ መሰል ክፍል አለው፤ ይህ ክፍል የአካል ብቃት እንቅስቃሴ ስናደርግ ትርፍ ደም እንዲይዝ ሊለጠጥ ይችላል።",
      quizQuestion: {
        question:
          "ቀኝ አትሪየም ኦክስጅን የበለፀገ ደም ከሳንባ ወይንስ ኦክስጅን የሌለው ደም ከሰውነት ይቀበላል?",
        answer: "ኦክስጅን የሌለው ደም ከሰውነት ይቀበላል።",
      },
    },
  },

  cardiac_muscle_jnt7: {
    en: {
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
    am: {
      title: "የልብ ጡንቻ (Myocardium)",
      description: `
        <p>የልብ ጡንቻ ወይም ማዮካርዲየም የሚባለው ወፍራም እና መካከለኛ የልብ ግድግዳ ንብርብር ነው። ይህ ጡንቻ ካርዲዮማዮሳይትስ በሚባሉ ልዩ ሴሎች የተገነባ ነው። እነዚህ ሴሎች የኤሌክትሪክ ምልክቶችን በፍጥነት እንዲያስተላልፉ በሚረዱ ኢንተርካሌትድ ዲስኮች የተሳሰሩ ናቸው። ይህ ልዩ መዋቅር ልብ በተቀናጀ እና በማዕበል መሰል ሁኔታ እንዲመታ ያስችለዋል። የልብ ጡንቻ በፍጹም አይደክምም፤ ምክንያቱም ከኮሮናሪ ደም ወሳጅ ቧንቧዎች በቂ የደም አቅርቦት ስለሚያገኝና ኃይልን በብቃት ስለሚያመነጭ ነው።</p>
        <ul>
          <li>የልብ ጡንቻ ሴሎች <strong>ግዴታ (involuntary)</strong> ናቸው - ልብዎ እንዲመታ ማሰብ አይጠበቅብዎትም፤ የአንጎል የነርቭ ሥርዓት በራሱ ይቆጣጠረዋል።</li>
          <li>እያንዳንዱ የልብ ትርታ የሚጀምረው "ሲኖአትሪያል (SA) ኖድ" በሚባል የልብ ተፈጥሯዊ የኤሌክትሪክ አመንጪ (pacemaker) ነው።</li>
          <li>የግራ ቬንትሪክል ደምን ለመላው ሰውነት መርጨት ስላለበት፣ ማዮካርዲየም በዚህ ክፍል ላይ በጣም ወፍራም ነው።</li>
          <li>ልብን እንደሌሎች ጡንቻዎች የአካል ብቃት እንቅስቃሴ በማድረግ ማወፈር አይቻልም፤ ነገር ግን ስፖርት ልብን ይበልጥ ቀልጣፋ ያደርገዋል።</li>
        </ul>
      `,
      funFact:
        "የልብ ጡንቻ ሴሎች እንደ መረብ የተሳሰሩ ናቸው። ይህም ልቡ እንደ አንድ አካል እንዲኮማተር ይረዳዋል - ልክ በመቶዎች የሚቆጠሩ ሰዎች እጅ ለእጅ ተያይዘው እንደሚጨምቁት።",
      quizQuestion: {
        question: "የልብ ጡንቻ በፍላጎት (በራሳችን ቁጥጥር) የሚሰራ ነው ወይንስ ያለ ፍላጎት (በራሱ)?",
        answer: "ያለ ፍላጎት (involuntary) - አንጎልዎ እርስዎ ሳያስቡበት በራሱ ይቆጣጠረዋል።",
      },
    },
  },

  right_pulmonary_valve_jnt9: {
    en: {
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
    am: {
      title: "የሳንባ ቫልቭ ቀኝ ክንፍ (Right Cusp)",
      description: `
        <p>የሳንባ (pulmonary) ቫልቭ በቀኝ ቬንትሪክል እና በሳንባ የደም ወሳጅ ቧንቧ መካከል ይገኛል። ሶስት የጨረቃ ቅርጽ ያላቸው ክንፎች (cusps) አሉት፡ ቀኝ፣ ግራ እና የፊት። ይህ ክፍል <strong>ቀኝ ክንፍን</strong> ይወክላል። ቀኝ ቬንትሪክል ሲኮማተር፣ ቫልቭው ይከፈትና ኦክስጅን የሌለው ደም ወደ ሳንባ እንዲሄድ ይፈቅዳል። ቬንትሪክል ሲላላ ደግሞ ክንፎቹ ተዘግተው ደም ወደ ኋላ እንዳይመለስ ይከላከላሉ።</p>
        <ul>
          <li>የሳንባ ቫልቭ ከሁለቱ "ሰሚሉናር" (ከፊል ጨረቃ) ቫልቮች አንዱ ነው።</li>
          <li>በእያንዳንዱ የልብ ትርታ ቫልቭው ደም ለማለፍ ለ0.1 ሰከንድ ያህል ብቻ ይከፈታል።</li>
          <li>ክንፉ በትክክል ካልተዘጋ ደም ወደ ኋላ ሊፈስ ይችላል፤ ይህም "pulmonary regurgitation" ይባላል።</li>
          <li>ይህ ቫልቭ እንደሌሎቹ የልብ ቫልቮች በጅማት (strings) የታሰረ አይደለም፤ የሚሰራው በደም ግፊት እና በቅርጹ ብቻ ነው።</li>
        </ul>
      `,
      funFact:
        "ሶስቱ የቫልቭ ክንፎች እንደየቦታቸው ቀኝ፣ ግራ እና የፊት ተብለው ይጠራሉ፤ ነገር ግን ቅርጻቸው ልክ እንደ ሶስት ተመሳሳይ ግማሽ ጨረቃዎች አንድ አይነት ነው።",
      quizQuestion: {
        question: "የሳንባ ቫልቭ ደም ከቀኝ ቬንትሪክል ወደ ሳንባ እንዲሄድ ይከፈታል ወይንስ ከሳንባ ወደ ልብ?",
        answer: "ከቀኝ ቬንትሪክል ወደ ሳንባ እንዲሄድ።",
      },
    },
  },

  left_pulmonary_valve_jnt11: {
    en: {
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
    am: {
      title: "የሳንባ ቫልቭ ግራ ክንፍ (Left Cusp)",
      description: `
        <p>ግራ ክንፍ የሳንባ ቫልቭን ከሚሰሩ ሶስት ክንፎች ሁለተኛው ነው። ከቀኝ እና ከፊት ክንፎች ጋር በመሆን ከቀኝ ቬንትሪክል የሚመጣው ደም ወደፊት ወደ ሳንባ ብቻ እንዲሄድ ያደርጋል። ግራ ክንፍ በአንዳንድ ሰዎች ላይ ከቀኝኛው ትንሽ ቀጠን ያለ ሊሆን ይችላል፤ ነገር ግን ሶስቱም ክንፎች የልብ ምት ግፊትን ለመቋቋም በሚችል ሁኔታ የተሰሩ ናቸው። ቫልቭው ሲዘጋ ጠርዞቻቸው መሃል ላይ ተገናኝተው ጥብቅ መዝጊያ ይፈጥራሉ።</p>
        <ul>
          <li>በሳንባ ቫልቭ ውስጥ የሚያልፍ ደም ካርቦን ዳይኦክሳይድ ስለሚሸከም ጥቁር ቀይ ነው፤ ደሙ ብሩህ ቀይ የሚሆነው ሳንባ ደርሶ ኦክስጅን ሲያገኝ ነው።</li>
          <li>እያንዳንዱ ክንፍ በትክክል እንዲዘጋ የሚረዳ "ኖዱል" የተባለ ትንሽ እብጠት አለው።</li>
          <li>በእረፍት ጊዜ በየደቂቃው 5 ሊትር ያህል ደም በዚህ ቫልቭ ውስጥ ያልፋል።</li>
        </ul>
      `,
      funFact:
        "የሳንባ ቫልቭ ግራ ክንፍ 'ሰሚሉናር' ይባላል፤ ትርጉሙም ግማሽ ጨረቃ ማለት ነው። ከላይ ሆኖ ለሚያየው ልክ እንደ ጨረቃ ቅርጽ ይታያል።",
      quizQuestion: {
        question: "በሳንባ ቫልቭ በኩል የሚያልፈው ደም ቀለሙ ምን አይነት ነው - ብሩህ ቀይ ወይንስ ጥቁር ቀይ?",
        answer: "ጥቁር ቀይ፣ ምክንያቱም ገና ሳንባ ስላልደረሰና ኦክስጅን ስላላገኘ።",
      },
    },
  },

  left_atrium_jnt13: {
    en: {
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
    am: {
      title: "ግራ አትሪየም (Left Atrium)",
      description: `
        <p>ግራ አትሪየም በልብ ላይኛው ግራ በኩል ይገኛል። ኦክስጅን የሌለው ደም ከሚቀበለው ቀኝ አትሪየም በተለየ፣ ግራ አትሪየም <strong>ኦክስጅን የበለፀገ</strong> ደምን በአራት የሳንባ ደም መልስ ቧንቧዎች በኩል ከሳንባ ይቀበላል። ከሞላ በኋላ ግራ አትሪየም ተኮማትሮ ደሙን በሚትራል ቫልቭ በኩል ወደ ግራ ቬንትሪክል ይገፋዋል፤ ከዚያም ግራ ቬንትሪክል ደሙን ለመላው ሰውነት ይረጨዋል።</p>
        <ul>
          <li>ግራ አትሪየም የግራ ቬንትሪክል ስራውን እስኪጨርስ ድረስ ደምን ለጥቂት ጊዜ እንደ ማጠራቀሚያ ያገለግላል።</li>
          <li>ይህ ክፍል ANP የሚባል ሆርሞን በማመንጨት ኩላሊቶች ትርፍ ጨውና ውሃ እንዲያስወግዱ በማድረግ የደም ግፊትን ለመቆጣጠር ይረዳል።</li>
          <li>"አትሪያል ፊብሪሌሽን" የሚባለው ያልተስተካከለ የልብ ምት ችግር ብዙ ጊዜ የሚጀምረው በዚህ ክፍል ውስጥ ነው።</li>
          <li>የግራ አትሪየም ግድግዳ ከቀኝ አትሪየም ትንሽ ወፈር ይላል።</li>
        </ul>
      `,
      funFact:
        "ግራ አትሪየም የሚቀበለው ደም ብሩህ ቀይ ነው፤ ምክንያቱም ትኩስ ኦክስጅን ከሳንባ ተሸክሞ ስለሚመጣ። ለዚህ ነው በስዕላዊ መግለጫዎች ላይ የልብ ግራ ክፍል በቀይ ቀለም የሚሳለው።",
      quizQuestion: {
        question: "ግራ አትሪየም ኦክስጅን የበለፀገ ወይንስ ኦክስጅን የሌለው ደም ይቀበላል?",
        answer: "ኦክስጅን የበለፀገ ደም ከሳንባ ይቀበላል።",
      },
    },
  },

  left_atrium_storage_jnt14: {
    en: {
      title: "Left Atrial Appendage (Storage Pouch)",
      description: `
        <p>The left atrial appendage (LAA) is a small, finger‑like pouch that extends from the left atrium. It is a remnant of the embryonic heart and can vary in size and shape. Although it was once thought to be a useless structure, we now know that it serves as a <strong>storage chamber</strong> that helps regulate blood volume and pressure. The LAA has muscular ridges inside (pectinate muscles) that allow it to expand and contract more than the smooth part of the left atrium.</p>
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
    am: {
      title: "የግራ አትሪያል አፔንዴጅ (ተጨማሪ ከረጢት)",
      description: `
        <p>የግራ አትሪያል አፔንዴጅ (LAA) ከግራ አትሪየም የሚወጣ ትንሽ የጣት ቅርጽ ያለው ከረጢት ነው። ምንም እንኳን ቀደም ሲል ጥቅም የሌለው ቢመስልም፣ አሁን ግን የደም መጠንን እና ግፊትን ለመቆጣጠር የሚረዳ <strong>የማከማቻ ክፍል</strong> መሆኑ ታውቋል። ይህ ከረጢት በውስጡ ያሉት ጡንቻዎች እንዲለጠጥና እንዲኮማተር ያስችሉታል።</p>
        <ul>
          <li>ልብ በእረፍት ላይ እያለ ይህ ከረጢት እስከ 10–15% የሚሆነውን የግራ አትሪየም ደም ሊይዝ ይችላል።</li>
          <li>በሰውነት ውስጥ የጨውና የውሃ ሚዛን እንዲጠበቅ የሚረዳ ሆርሞን (ANP) ያመነጫል።</li>
          <li>ባልተስተካከለ የልብ ምት (atrial fibrillation) ጊዜ ደም እዚህ ከረጢት ውስጥ ተከማችቶ ሊረጋ ስለሚችል፣ ሐኪሞች ለስትሮክ (stroke) እንዳይዳርግ ሲሉ አንዳንድ ጊዜ ይዘጉታል።</li>
          <li>እንደ ቀኝ አፔንዴጅ ሳይሆን፣ የግራው ረዘም ያለና ጠባብ ሲሆን የመልጎምዘዝ (hook) ቅርጽ አለው።</li>
        </ul>
      `,
      funFact:
        "የዚህ ከረጢት ቅርጽ ከሰው ሰው ይለያያል፤ የአንዳንዶች ረጅም እና ቀጭን፣ የአንዳንዶች ደግሞ እንደ ትንሽ እጅ ጣቶች ያሉ ቅርጽ ሊኖራቸው ይችላል።",
      quizQuestion: {
        question: "ከደም ማጠራቀም ውጪ የዚህ ከረጢት ሌላው አስፈላጊ ስራ ምንድን ነው?",
        answer: "በሰውነት ውስጥ የጨው እና የውሃ መጠንን ለመቆጣጠር የሚረዳ ሆርሞን ያመነጫል።",
      },
    },
  },

  left_mitral_valve_jnt15: {
    en: {
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
    am: {
      title: "የሚትራል ቫልቭ የግራ (የፊት) ክንፍ",
      description: `
        <p>ሚትራል ቫልቭ በግራ አትሪየም እና በግራ ቬንትሪክል መካከል ይገኛል። ሁለት ክንፎች (leaflets) አሉት፡ የፊት (ግራ) እና የኋላ (ቀኝ)። ይህ ክፍል <strong>የፊት ክንፍን</strong> ይወክላል። የፊት ክንፍ ከኋላኛው ይልቅ ትልቅ እና ይበልጥ ተንቀሳቃሽ ነው። ግራ አትሪየም ሲኮማተር ደም በሁለቱ ክንፎች መካከል አልፎ ወደ ቬንትሪክል ይገባል። ቬንትሪክል ሲኮማተር ደግሞ ክንፎቹ ተዘግተው ደም ወደ ኋላ እንዳይመለስ ይከላከላሉ። ይህ ክንፍ "ኮርዳ ቴንዲኔ" በሚባሉ ጠንካራ ገመድ መሰል ጅማቶች ከልብ ግድግዳ ጋር ተያይዟል።</p>
        <ul>
          <li>የፊት ክንፉ ከቫልቭው መክፈቻ ሁለት ሶስተኛውን (2/3) ይሸፍናል።</li>
          <li>በልብ ትርታ ጊዜ ይህ ክንፍ እንደ ተንቀሳቃሽ በር ወደ ኋላና ወደ ፊት ይወዛወዛል።</li>
          <li>"ሚትራል ቫልቭ ፕሮላፕስ" የሚባለው ችግር (ክንፉ ወደ ኋላ ሲገልበጥ) ብዙ ጊዜ በዚህ የፊት ክንፍ ላይ ይከሰታል።</li>
          <li>ይህ ክንፍ ከአኦርቲክ ቫልቭ መዋቅር ጋር ስለሚቀራረብ አንዳንድ ጊዜ "Aortic leaflet" ይባላል።</li>
        </ul>
      `,
      funFact:
        "የሚትራል ቫልቭ የፊት ክንፍ ልክ እንደ ሸራ (sail) ነው፤ ቬንትሪክል ሲኮማተር ደም እንዳያልፍ ወደ ላይ ይወጠራል - ልክ ንፋስ ለመከላከል እንደሚገጠሙ ሁለት ሸራዎች።",
      quizQuestion: {
        question:
          "የሚትራል ቫልቭ የፊት ክንፍ ወደ ኋላ እንዳይገልበጥ ከልብ ግድግዳ ጋር የሚያያይዘው መዋቅር ምንድን ነው?",
        answer: "ኮርዳ ቴንዲኔ (Chordae tendineae) - ጠንካራ ገመድ መሰል ጅማቶች።",
      },
    },
  },

  right_mitral_valve_jnt16: {
    en: {
      title: "Right Leaflet of the Mitral Valve (Posterior Cusp)",
      description: `
        <p>The posterior leaflet (right leaflet) of the mitral valve is the second of the two flaps that make up the mitral valve. It is smaller and shorter than the anterior leaflet, and it is often divided into three scallops (indentations). While the anterior leaflet does most of the moving, the posterior leaflet provides a stable backstop that helps create a watertight seal when the valve closes.</p>
        <ul>
          <li>The posterior leaflet is sometimes called the <em>mural leaflet</em> because it is attached to the wall (murus in Latin) of the ventricle.</li>
          <li>In the closed position, the posterior leaflet supports about one‑third of the sealing surface; the anterior leaflet covers the rest.</li>
          <li>Mitral regurgitation (leaky valve) is more often due to problems of the posterior leaflet, such as flail or prolapse of one of its scallops.</li>
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
    am: {
      title: "የሚትራል ቫልቭ የቀኝ (የኋላ) ክንፍ",
      description: `
        <p>የኋላ (ቀኝ) ክንፍ ሚትራል ቫልቭን ከሚሰሩት ሁለት ክንፎች አንዱ ነው። ከፊት ክንፍ ይልቅ ትንሽ እና አጭር ሲሆን፣ በሶስት ትናንሽ ክፍሎች (scallops) የተከፈለ ነው። የፊት ክንፉ አብዛኛውን እንቅስቃሴ ሲያደርግ፣ የኋላኛው ክንፍ ደግሞ እንደ መደገፊያ ሆኖ በማገልገል ቫልቭው ሲዘጋ ደም እንዳያሳልፍ ይረዳል።</p>
        <ul>
          <li>ይህ ክንፍ ከቬንትሪክል ግድግዳ ጋር ተያይዞ ስለሚገኝ "Mural leaflet" ተብሎም ይጠራል።</li>
          <li>ቫልቭው ሲዘጋ የኋላኛው ክንፍ አንድ ሶስተኛውን (1/3) ክፍል ይሸፍናል።</li>
          <li>የሚትራል ቫልቭ ደም ማፍሰስ (regurgitation) ችግር ብዙ ጊዜ በዚህ ክንፍ መላላት ወይም መገልበጥ ምክንያት ይከሰታል።</li>
        </ul>
      `,
      funFact:
        "የሚትራል ቫልቭ የኋላ ክንፍ ሶስት የተፈጥሮ ስንጥቆች አሉት፤ ይህም ልክ ባለ ሶስት ቅጠል ክሎቨር (clover) ያስመስለዋል።",
      quizQuestion: {
        question: "የትኛው ይበልጣል - የሚትራል ቫልቭ የፊት (ግራ) ክንፍ ወይንስ የኋላ (ቀኝ) ክንፍ?",
        answer: "የፊት (Anterior) ክንፍ ይበልጣል።",
      },
    },
  },

  aortic_valve_02_jnt17: {
    en: {
      title: "Aortic Valve – Right Coronary Cusp (Cusp 2)",
      description: `
        <p>The aortic valve sits between the left ventricle and the aorta, the largest artery in the body. Like the pulmonary valve, it has three semilunar cusps: the left coronary cusp, the right coronary cusp (this part), and the non‑coronary cusp. The right coronary cusp is named because the right coronary artery originates from a small opening just above this cusp. When the left ventricle contracts, the aortic valve opens and oxygenated blood rushes into the aorta. When the ventricle relaxes, the cusps fill with blood and snap closed, preventing backflow.</p>
        <ul>
          <li>The right coronary cusp is the most common site for aortic valve calcification (hardening) in older adults, which can narrow the valve (aortic stenosis).</li>
          <li>Blood pressure in the aorta is much higher than in the pulmonary artery, so the aortic valve is thicker and stronger than the pulmonary valve.</li>
          <li>When this cusp fails to open fully, the left ventricle must work much harder to pump blood out.</li>
        </ul>
      `,
      funFact:
        "The right coronary cusp of the aortic valve has a tiny opening just above it that leads to the right coronary artery – the blood vessel that feeds the right side of the heart muscle.",
      quizQuestion: {
        question:
          "What is the name of the largest artery that the aortic valve opens into?",
        answer: "The aorta.",
      },
    },
    am: {
      title: "አኦርቲክ ቫልቭ – ቀኝ ኮሮናሪ ክንፍ",
      description: `
        <p>አኦርቲክ ቫልቭ በግራ ቬንትሪክል እና በአኦርታ (በሰውነታችን ትልቁ የደም ቧንቧ) መካከል ይገኛል። ሶስት ክንፎች አሉት፡ የግራ ኮሮናሪ፣ የቀኝ ኮሮናሪ (ይህ ክፍል) እና ኮሮናሪ ያልሆነ ክንፍ። የቀኝ ኮሮናሪ ክንፍ የተባለው "ቀኝ ኮሮናሪ የደም ቧንቧ" ከዚህ ክንፍ በላይ ስለሚነሳ ነው። ግራ ቬንትሪክል ሲኮማተር ቫልቭው ይከፈትና ደም ወደ አኦርታ ይፈሳል። ቬንትሪክል ሲላላ ቫልቭው ተዘግቶ ደም ወደ ልብ እንዳይመለስ ያደርጋል።</p>
        <ul>
          <li>በአረጋውያን ላይ ቫልቭው ሲጠጥር (calcification) ብዙ ጊዜ የሚከሰተው በዚህ ክፍል ላይ ነው።</li>
          <li>በአኦርታ ውስጥ ያለው የደም ግፊት ከፍተኛ ስለሆነ፣ አኦርቲክ ቫልቭ ከሳንባ (pulmonary) ቫልቭ ይልቅ ወፍራም እና ጠንካራ ነው።</li>
          <li>ይህ ክንፍ ሙሉ በሙሉ ካልተከፈተ፣ ግራ ቬንትሪክል ደም ለመርጨት በጣም መድከም ይኖርበታል።</li>
        </ul>
      `,
      funFact:
        "የቀኝ ኮሮናሪ ክንፍ ከበላዩ ትንሽ ቀዳዳ አለው፤ ይህ ቀዳዳ ለልብ ጡንቻ ደም ወደሚያደርሰው 'ቀኝ ኮሮናሪ ቧንቧ' ይወስዳል።",
      quizQuestion: {
        question: "አኦርቲክ ቫልቭ የሚከፈትበት የሰውነታችን ትልቁ የደም ቧንቧ ስም ማን ይባላል?",
        answer: "አኦርታ (Aorta)።",
      },
    },
  },

  aortic_valve_03_jnt19: {
    en: {
      title: "Aortic Valve – Non‑Coronary Cusp (Cusp 3)",
      description: `
        <p>The non‑coronary cusp is the third flap of the aortic valve, so named because no coronary artery originates from its associated sinus (pouch). It sits on the posterior side of the aortic root, opposite the right coronary cusp. Like the other two cusps, it opens to allow blood to leave the heart and closes to prevent backflow.</p>
        <ul>
          <li>Because the non‑coronary cusp has no artery branching from its sinus, it is sometimes the preferred site for certain heart surgeries.</li>
          <li>During each heartbeat, the non‑coronary cusp experiences forces up to 5 times the normal blood pressure in the aorta.</li>
          <li>Unlike the mitral and tricuspid valves, the aortic valve has no chordae tendineae; its cusps are flexible but held in place by the fibrous skeleton of the heart.</li>
        </ul>
      `,
      funFact:
        "The non‑coronary cusp is the only one of the three aortic valve cusps that does NOT have a coronary artery above it. That's why doctors sometimes choose it as the best place to make a small cut during heart surgery!",
      quizQuestion: {
        question: "How many cusps (flaps) does the aortic valve have?",
        answer:
          "Three cusps – the left coronary, right coronary, and non‑coronary.",
      },
    },
    am: {
      title: "አኦርቲክ ቫልቭ – ኮሮናሪ ያልሆነ ክንፍ",
      description: `
        <p>ይህ ክፍል ኮሮናሪ ያልሆነ ክንፍ የተባለው ከበላዩ ምንም አይነት የልብ ደም ቧንቧ (coronary artery) ስለማይነሳ ነው። ከአኦርቲክ ቫልቭ ሶስት ክንፎች አንዱ ሲሆን፣ ከሌሎቹ ጋር በመሆን ደም ከልብ ወጥቶ ወደ ሰውነት እንዲሄድና ወደ ኋላ እንዳይመለስ ያደርጋል።</p>
        <ul>
          <li>ከበላዩ ደም ቧንቧ ስለሌለ፣ ሐኪሞች ለልብ ቀዶ ጥገና ይህን ክፍል መቁረጥ ይመርጣሉ (ሌላ ቧንቧ የመጉዳት ስጋት ስለማይኖር)።</li>
          <li>ይህ ቫልቭ በአኦርታ ውስጥ ያለውን ከፍተኛ የደም ግፊት ለብዙ ዓመታት ሳይጎዳ የመቋቋም ችሎታ አለው።</li>
          <li>እንደ ሚትራል ቫልቭ ሳይሆን፣ አኦርቲክ ቫልቭ ምንም አይነት የጅማት ገመዶች የሉትም፤ በልብ ፋይበር መዋቅር ብቻ ተይዞ ይቆያል።</li>
        </ul>
      `,
      funFact:
        "ይህ ክንፍ ከበላዩ የልብ ደም ቧንቧ የሌለው ብቸኛው የአኦርቲክ ቫልቭ ክንፍ ነው፤ ለዚህ ነው ሐኪሞች ለቀዶ ጥገና የሚመርጡት።",
      quizQuestion: {
        question: "አኦርቲክ ቫልቭ ስንት ክንፎች (flaps) አሉት?",
        answer: "ሶስት - የግራ ኮሮናሪ፣ የቀኝ ኮሮናሪ እና ኮሮናሪ ያልሆነ።",
      },
    },
  },

  aortic_valve_01_jnt21: {
    en: {
      title: "Aortic Valve – Left Coronary Cusp (Cusp 1)",
      description: `
        <p>The left coronary cusp is the first of the three aortic valve cusps. It is named because the left main coronary artery (which supplies blood to the front and side of the heart) arises from a small opening in the aorta just above this cusp. Together with the other two cusps, it creates a one‑way valve that ensures blood flows from the left ventricle into the aorta and then to the entire body.</p>
        <ul>
          <li>Inside the sinus behind this cusp, swirling blood helps the valve close efficiently.</li>
          <li>If this cusp becomes stiff or calcified, it can reduce blood flow to the heart muscle through the left coronary artery, causing chest pain (angina).</li>
          <li>During intense exercise, the left coronary cusp may open and close more than 150,000 times per day.</li>
        </ul>
      `,
      funFact:
        "The left coronary cusp is nicknamed the 'widowmaker' cusp by some doctors because the left main coronary artery above it, if blocked, causes a very dangerous heart attack.",
      quizQuestion: {
        question:
          "What important blood vessel comes out of the aorta just above the left coronary cusp?",
        answer: "The left main coronary artery.",
      },
    },
    am: {
      title: "አኦርቲክ ቫልቭ – ግራ ኮሮናሪ ክንፍ",
      description: `
        <p>የግራ ኮሮናሪ ክንፍ ከአኦርቲክ ቫልቭ ሶስት ክንፎች አንዱ ነው። የልብን የፊትና የጎን ክፍል የሚመግበው "ግራ ዋና ኮሮናሪ ቧንቧ" ከዚህ ክንፍ በላይ ካለ ቀዳዳ ስለሚነሳ በዚህ ስም ተጠርቷል። ከሌሎቹ ክንፎች ጋር በመሆን ደም ከግራ ቬንትሪክል ወደ አኦርታ እንዲፈስና ወደ ኋላ እንዳይመለስ ያደርጋል።</p>
        <ul>
          <li>በክንፉ በስተጀርባ ባለው ቦታ (sinus) ውስጥ ደም ይሽከረከራል፤ ይህም ቫልቭው በፍጥነት እንዲዘጋ ይረዳዋል።</li>
          <li>ይህ ክንፍ ከጠጠረ (calcified)፣ ለልብ ጡንቻ የሚሄደው ደም ስለሚቀንስ የደረት ህመም (angina) ሊያስከትል ይችላል።</li>
          <li>በከባድ እንቅስቃሴ ጊዜ ይህ ቫልቭ በቀን ከ150,000 ጊዜ በላይ ሊከፈትና ሊዘጋ ይችላል።</li>
        </ul>
      `,
      funFact:
        "ይህ ክንፍ በአንዳንድ ዶክተሮች 'widowmaker' (ባለቤት አሳጪ) በሚል ቅጽል ስም ይጠራል፤ ምክንያቱም ከበላዩ ያለው ደም ቧንቧ ከተዘጋ በጣም አደገኛ የልብ ድካም ስለሚያስከትል ነው።",
      quizQuestion: {
        question:
          "ከግራ ኮሮናሪ ክንፍ በላይ ካለው አኦርታ የሚወጣው አስፈላጊ የልብ ደም ቧንቧ ስም ማን ይባላል?",
        answer: "ግራ ዋና ኮሮናሪ የደም ቧንቧ (Left main coronary artery)።",
      },
    },
  },

  left_tricuspid_valve_jnt23: {
    en: {
      title: "Tricuspid Valve – Left (Septal) Leaflet",
      description: `
        <p>The tricuspid valve is the valve between the right atrium and the right ventricle. It normally has three leaflets: anterior (front), posterior (back), and septal (attached to the septum, the wall between the ventricles). This part represents the <strong>septal (left) leaflet</strong>. The septal leaflet is the smallest of the three and is attached directly to the muscular wall that separates the two ventricles.</p>
        <ul>
          <li>The septal leaflet is attached to the interventricular septum via several small chordae tendineae.</li>
          <li>This leaflet is often the site of <em>Ebstein’s anomaly</em>, a rare birth defect.</li>
          <li>Because the right side of the heart works at lower pressure, the tricuspid valve is thinner than the mitral valve.</li>
          <li>It lies close to the heart’s electrical conduction system (the bundle of His).</li>
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
    am: {
      title: "ትራይከስፒድ ቫልቭ – የግራ (ሴፕታል) ክንፍ",
      description: `
        <p>ትራይከስፒድ ቫልቭ በቀኝ አትሪየም እና በቀኝ ቬንትሪክል መካከል ይገኛል። ሶስት ክንፎች አሉት፡ የፊት፣ የኋላ እና ሴፕታል (ከመሃል ግድግዳ ጋር የተያያዘ)። ይህ ክፍል <strong>ሴፕታል (ግራ) ክንፍን</strong> ይወክላል። ሴፕታል ክንፍ ከሶስቱ ትንሹ ሲሆን በሁለቱ ቬንትሪክሎች መካከል ካለው የጡንቻ ግድግዳ ጋር በቀጥታ የተያያዘ ነው።</p>
        <ul>
          <li>ይህ ክንፍ "ሴፕተም" (septum) ከሚባለው የልብ መካከለኛ ግድግዳ ጋር በጅማቶች ተያይዟል።</li>
          <li>የልብ የቀኝ ክፍል ዝቅተኛ የደም ግፊት ስላለው፣ ትራይከስፒድ ቫልቭ ከሚትራል ቫልቭ ይልቅ ቀጭን ነው።</li>
          <li>ይህ ክንፍ የልብ የኤሌክትሪክ ምልክት ለሚያስተላልፈው ክፍል (bundle of His) በጣም ቅርብ ነው።</li>
          <li>"Ebstein’s anomaly" የሚባለው የልደት ጉድለት ብዙ ጊዜ በዚህ ክንፍ ላይ ይከሰታል።</li>
        </ul>
      `,
      funFact:
        "የትራይከስፒድ ሴፕታል ክንፍ በሁለቱ ቬንትሪክሎች መሃል ካለው ግድግዳ ጋር በቀጥታ የተያያዘ ብቸኛው የልብ ቫልቭ ክንፍ ነው፤ ለዚህም 'የግድግዳ አበባ' (wallflower) ሊባል ይችላል!",
      quizQuestion: {
        question: "ትራይከስፒድ ቫልቭ ስንት ክንፎች አሉት - ሁለት፣ ሶስት ወይንስ አራት?",
        answer: "ሶስት ክንፎች - ለዚህ ነው 'ትራይ' (tri) የተባለው።",
      },
    },
  },

  right_tricuspid_valve_jnt24: {
    en: {
      title: "Tricuspid Valve – Right (Anterior) Leaflet",
      description: `
        <p>The anterior leaflet (right leaflet) of the tricuspid valve is the largest and most mobile of the three tricuspid valve leaflets. It attaches to the free wall of the right ventricle, opposite the septal leaflet. During contraction of the right atrium, this leaflet swings open to allow blood to pass into the right ventricle. Then, when the right ventricle squeezes, the anterior leaflet rises to meet the other two leaflets, completely sealing the valve opening.</p>
        <ul>
          <li>The anterior leaflet often has a rough, scalloped edge that helps create a more effective seal.</li>
          <li>In a condition called <em>tricuspid regurgitation</em>, the anterior leaflet is most often involved because it is the largest and experiences the greatest mechanical stress.</li>
          <li>It is the preferred target for surgical tricuspid valve repair.</li>
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
    am: {
      title: "ትራይከስፒድ ቫልቭ – የቀኝ (የፊት) ክንፍ",
      description: `
        <p>የፊት (ቀኝ) ክንፍ ከትራይከስፒድ ቫልቭ ክንፎች ሁሉ ትልቁ እና ይበልጥ ተንቀሳቃሽ የሆነው ነው። በቀኝ ቬንትሪክል ግድግዳ ላይ ተያይዞ ይገኛል። ቀኝ አትሪየም ሲኮማተር ይህ ክንፍ ተከፍቶ ደም ወደ ቀኝ ቬንትሪክል እንዲገባ ያደርጋል። ከዚያም ቬንትሪክል ሲጨምቅ የፊት ክንፉ ወደ ላይ ተነስቶ ከሌሎቹ ጋር በመገጠም ቫልቭውን ሙሉ በሙሉ ይዘጋዋል።</p>
        <ul>
          <li>የፊት ክንፉ ሸካራ ጠርዝ አለው፤ ይህም ቫልቭው ሲዘጋ ደም እንዳያሳልፍ ይረዳዋል።</li>
          <li>በትልቅነቱ ምክንያት ይህ ክንፍ ከሌሎቹ በበለጠ ጫና ስለሚደርስበት ለቫልቭ መላላት (regurgitation) ችግር ተጋላጭ ነው።</li>
          <li>ቀዶ ጥገና በሚደረግበት ጊዜ ሐኪሞች ቫልቭውን ለማጥበብ ብዙ ጊዜ ትኩረት የሚያደርጉት በዚህ ክንፍ ላይ ነው።</li>
        </ul>
      `,
      funFact:
        "የትራይከስፒድ የፊት ክንፍ በጣም ትልቅ ከመሆኑ የተነሳ የቫልቭውን መክፈቻ ግማሽ ያህሉን ብቻውን ይሸፍናል፤ ልክ እንደ ትልቅ በር ቫልቭውን ለመዝጋት ዋናውን ስራ ይሰራል!",
      quizQuestion: {
        question:
          "የትኛው የትራይከስፒድ ቫልቭ ክንፍ ነው ትልቁ እና ይበልጥ ተንቀሳቃሽ የሆነው - ሴፕታል፣ የኋላ ወይንስ የፊት (ቀኝ)?",
        answer: "የፊት (Anterior) ክንፍ።",
      },
    },
  },
};

// Kidney Organ Data
let kidneyOrganData = {
  KidneyOutside_Riñon_0: {
    en: {
      title: "Kidney Body (Renal Parenchyma)",
      description: `
        <p>The kidney body is the main mass of the organ. It is protected by a tough, thin outer layer called the renal capsule. Underneath the capsule, the kidney body is divided into two regions: the outer <strong>renal cortex</strong> (darker, containing filtering units) and the inner <strong>renal medulla</strong> (lighter, containing cone‑shaped pyramids). Together, these tissues filter waste from blood, reabsorb needed substances, and produce urine. The bean‑shape of the kidney body maximizes surface area inside a compact space.</p>
        <ul>
          <li>Each kidney body contains about <strong>1 million</strong> tiny filters called nephrons – that’s where urine production begins.</li>
          <li>The renal cortex receives the most blood flow because it does the initial filtering.</li>
          <li>The kidney body is surrounded by a layer of fat that cushions and anchors it in place.</li>
          <li>Despite being only 5% of your body weight, kidneys receive 20–25% of your blood with every heartbeat.</li>
        </ul>
      `,
      funFact:
        "Your kidney body is so good at filtering that it cleans your entire blood volume about 40 times every day – that’s over 1,500 liters of blood!",
      quizQuestion: {
        question: "What are the two main regions inside the kidney body?",
        answer: "The renal cortex (outer) and renal medulla (inner).",
      },
    },
    am: {
      title: "የኩላሊት አካል (Renal Parenchyma)",
      description: `
        <p>የኩላሊት አካል የኩላሊቱ ዋናው ክፍል ነው። ሬናል ካፕሱል በሚባል ቀጭንና ጠንካራ ውጫዊ ሽፋን ይጠበቃል። ከሽፋኑ በታች፣ የኩላሊቱ አካል በሁለት ይከፈላል፡ የውጪኛው <strong>ሬናል ኮርቴክስ</strong> (ጠቆር ያለና የማጣሪያ ክፍሎችን የያዘ) እና የውስጠኛው <strong>ሬናል ሜዱላ</strong> (ቀለል ያለና የፒራሚድ ቅርጽ ያላቸውን ክፍሎች የያዘ) ናቸው። እነዚህ ቲሹዎች በጋራ ደምን ያጣራሉ፣ አስፈላጊ የሆኑ ነገሮችን መልሰው ይመጥጣሉ፣ እንዲሁም ሽንትን ያመነጫሉ። የኩላሊት የባቄላ ቅርጽ መሆኑ በትንሽ ቦታ ውስጥ ሰፊ የማጣሪያ ቦታ እንዲኖረው ይረዳዋል።</p>
        <ul>
          <li>እያንዳንዱ ኩላሊት ወደ <strong>1 ሚሊዮን</strong> የሚጠጉ ኔፍሮን የሚባሉ ጥቃቅን ማጣሪያዎችን ይዟል - የሽንት ምርት የሚጀምረው እዚህ ነው።</li>
          <li>ሬናል ኮርቴክስ የመጀመሪያውን ማጣሪያ ስለሚያከናውን ከፍተኛውን የደም ፍሰት ያገኛል።</li>
          <li>የኩላሊት አካል በስብ (Fat) ንብርብር የተከበበ ሲሆን ይህም ኩላሊቱ እንዳይናወጥና በቦታው እንዲቀመጥ ያደርጋል።</li>
          <li>ኩላሊት የሰውነት ክብደት 5% ብቻ ቢሆንም፣ በእያንዳንዱ የልብ ትርታ ከ20–25% የሚሆነውን ደም ይቀበላል።</li>
        </ul>
      `,
      funFact:
        "የኩላሊትዎ የማጣራት አቅም በጣም ከፍተኛ ከመሆኑ የተነሳ በቀን ውስጥ 40 ጊዜ ያህል መላ ደምዎን ያጸዳል - ይህም ከ1,500 ሊትር በላይ ደም ነው!",
      quizQuestion: {
        question: "በኩላሊት አካል ውስጥ ያሉት ሁለት ዋና ዋና ክፍሎች ምን ምን ናቸው?",
        answer: "ሬናል ኮርቴክስ (የውጪኛው) እና ሬናል ሜዱላ (የውስጠኛው)።",
      },
    },
  },

  KidneyOutside_kidneyEdge_0: {
    en: {
      title: "Kidney Outer Edge (Lateral Border)",
      description: `
        <p>The kidney outer edge is the curved, convex side of the bean‑shaped organ. It faces outward toward the side of your body. This edge is covered by the renal capsule and contains mostly the renal cortex, where blood filtration begins. The convex shape helps the kidney fit snugly against the back muscles and the diaphragm. The opposite side of the kidney (the concave side) is called the <strong>hilum</strong> – where blood vessels and the ureter enter and exit.</p>
        <ul>
          <li>The outer edge is smooth and rounded, which prevents damage from rubbing against other organs.</li>
          <li>Below the capsule on the outer edge, the cortex contains millions of tiny blood vessels (glomeruli) where filtration starts.</li>
          <li>The outer edge is also where the kidney is easiest to feel during a medical exam, though it is deep inside the lower back.</li>
          <li>In a healthy adult, each kidney’s outer edge is about 10–12 cm long – roughly the size of a computer mouse.</li>
        </ul>
      `,
      funFact:
        "The outer edge of the kidney is convex (curving outward) like the back of a spoon – and the inner edge is concave (curving inward) like the bowl of the spoon, where the ureter attaches.",
      quizQuestion: {
        question:
          "What is the name of the concave inner side of the kidney where blood vessels and the ureter connect?",
        answer: "The hilum.",
      },
    },
    am: {
      title: "የኩላሊት ውጫዊ ጠርዝ (Lateral Border)",
      description: `
        <p>የኩላሊት ውጫዊ ጠርዝ የባቄላ ቅርጽ ያለው ኩላሊት የተቆለፈመ (convex) ጎን ነው። ወደ ጎንኛው የሰውነት ክፍል ፊት ለፊት ይመለከታል። ይህ ጠርዝ በሬናል ካፕሱል የተሸፈነ ሲሆን አብዛኛውን ጊዜ የደም ማጣራት የሚጀምርበትን ሬናል ኮርቴክስ ይዟል። ይህ ቅርጽ ኩላሊቱ ከጀርባ ጡንቻዎች እና ከዲያፍራም ጋር ተጣብቆ እንዲቀመጥ ይረዳዋል። የኩላሊቱ ተቃራኒው ጎን (ወደ ውስጥ የገባው ክፍል) <strong>ሂለም</strong> ይባላል - ይህ ደም ሥሮችና ሽንት ቧንቧ (ureter) የሚገቡበትና የሚወጡበት ቦታ ነው።</p>
        <ul>
          <li>ውጫዊው ጠርዝ ለስላሳ እና ክብ በመሆኑ ከሌሎች አካላት ጋር ሲጋጭ ጉዳት እንዳይደርስ ይከላከላል።</li>
          <li>ከካፕሱሉ በታች ባለው ውጫዊ ጠርዝ ላይ፣ ኮርቴክስ ማጣራት የሚጀምርባቸውን በሚሊዮን የሚቆጠሩ ጥቃቅን የደም ሥሮች (glomeruli) ይዟል።</li>
          <li>ኩላሊት በታችኛው ጀርባ ውስጥ ጠልቆ የሚገኝ ቢሆንም፣ በሕክምና ምርመራ ወቅት በቀላሉ ሊሰማ የሚችለው በውጫዊው ጠርዝ በኩል ነው።</li>
          <li>በጤናማ አዋቂ ሰው ውስጥ እያንዳንዱ የኩላሊት ውጫዊ ጠርዝ ከ10–12 ሳ.ሜ ይረዝማል - ይህም በግምት የኮምፒውተር ማውዝ ያህል ነው።</li>
        </ul>
      `,
      funFact:
        "የኩላሊት ውጫዊ ጠርዝ እንደ ማንኪያ ጀርባ ወደ ውጭ የወጣ ሲሆን፣ የውስጠኛው ጠርዝ ደግሞ እንደ ማንኪያ ጎድጓዳ ክፍል ወደ ውስጥ የገባ ነው፤ ሽንት ቧንቧውም የሚገናኘው እዚያ ጋር ነው።",
      quizQuestion: {
        question:
          "የደም ሥሮች እና የሽንት ቧንቧ የሚገናኙበት የኩላሊቱ የውስጠኛው ጎድጓዳ ክፍል ስም ማን ይባላል?",
        answer: "ሂለም (Hilum)።",
      },
    },
  },

  BezierCurve_arterias_0: {
    en: {
      title: "Renal Arteries",
      description: `
        <p>The renal arteries are blood vessels that carry <strong>oxygenated blood</strong> from the aorta (the main artery from the heart) directly to the kidneys. Each kidney receives one renal artery. Once inside the kidney, the renal artery branches into smaller and smaller arteries – eventually becoming tiny balls of capillaries called <strong>glomeruli</strong>. In the glomeruli, waste products and excess water are squeezed out of the blood to begin forming urine. The renal arteries deliver about 1.2 liters of blood to the kidneys every minute.</p>
        <ul>
          <li>Renal arteries are unique because they branch directly off the aorta – no other arteries in between.</li>
          <li>Blood pressure in the renal arteries is high, which helps push fluid out into the nephrons for filtration.</li>
          <li>If a renal artery becomes narrowed (a condition called <em>renal artery stenosis</em>), blood pressure can rise dangerously.</li>
          <li>The right renal artery is longer than the left because it must cross behind the vena cava to reach the right kidney.</li>
        </ul>
      `,
      funFact:
        "Your kidneys receive more blood relative to their size than almost any other organ – about 20% of all blood pumped by the heart goes through the renal arteries!",
      quizQuestion: {
        question:
          "Does the renal artery carry blood into the kidney or out of the kidney?",
        answer: "Into the kidney (it brings oxygenated blood).",
      },
    },
    am: {
      title: "የኩላሊት ደም ወሳጅ ቧንቧዎች (Renal Arteries)",
      description: `
        <p>የኩላሊት ደም ወሳጅ ቧንቧዎች ኦክስጅን የበለፀገ ደምን ከአኦርታ (ከልብ የሚወጣው ዋና የደም ቧንቧ) በቀጥታ ወደ ኩላሊት የሚያመጡ የደም ሥሮች ናቸው። እያንዳንዱ ኩላሊት አንድ የሬናል ደም ወሳጅ ቧንቧ ይቀበላል። ኩላሊት ውስጥ ከገባ በኋላ ቧንቧው ወደ ትናንሽ ቅርንጫፎች ይከፈላል፤ በመጨረሻም <strong>ግሎሜሩሊ</strong> የሚባሉ ጥቃቅን የደም ሥሮች ይሆናሉ። በግሎሜሩሊ ውስጥ ቆሻሻዎችና ትርፍ ውሃ ከደም ተለይተው ሽንት መፈጠር ይጀምራል። የሬናል ደም ወሳጅ ቧንቧዎች በየደቂቃው 1.2 ሊትር ያህል ደም ወደ ኩላሊት ያደርሳሉ።</p>
        <ul>
          <li>የሬናል ደም ወሳጅ ቧንቧዎች ልዩ የሚያደርጋቸው በቀጥታ ከአኦርታ መነሳታቸው ነው - በመካከላቸው ሌላ ቧንቧ የለም።</li>
          <li>በእነዚህ ቧንቧዎች ውስጥ ያለው የደም ግፊት ከፍተኛ በመሆኑ፣ ፈሳሽ ወደ ኔፍሮን እንዲገፋና እንዲጣራ ይረዳል።</li>
          <li>የሬናል ደም ወሳጅ ቧንቧ ከጠበበ (renal artery stenosis)፣ የደም ግፊት በከፍተኛ ሁኔታ ሊጨምር ይችላል።</li>
          <li>የቀኝ ሬናል ደም ወሳጅ ቧንቧ ወደ ቀኝ ኩላሊት ለመድረስ በቬና ካቫ ጀርባ ማለፍ ስላለበት ከግራው ይረዝማል።</li>
        </ul>
      `,
      funFact:
        "ኩላሊቶችዎ ከክብደታቸው አንጻር ከማንኛውም አካል በላይ ደም ይቀበላሉ - ከልብ ከሚረጨው ደም ውስጥ 20% የሚሆነው በሬናል ደም ወሳጅ ቧንቧዎች በኩል ያልፋል!",
      quizQuestion: {
        question: "የሬናል ደም ወሳጅ ቧንቧ ደምን ወደ ኩላሊት ያመጣል ወይንስ ከኩላሊት ያስወጣል?",
        answer: "ወደ ኩላሊት ያመጣል (ኦክስጅን ያለው ደም ያመጣል)።",
      },
    },
  },

  BezierCurve001_tronco_0: {
    en: {
      title: "Renal Trunk (Main Renal Pedicle)",
      description: `
        <p>The renal trunk is the bundle of structures that enters and exits the kidney at the hilum. It includes the <strong>renal artery</strong> (bringing blood in), the <strong>renal vein</strong> (taking filtered blood out), and the <strong>ureter</strong> (carrying urine away). This bundle is surrounded by fat and connective tissue that holds everything together. The renal trunk is sometimes called the “renal pedicle” because it looks like a stalk attaching the kidney to the rest of the body. Without the renal trunk, the kidney would have no blood supply and no way to drain urine.</p>
        <ul>
          <li>The renal trunk is about 2–3 cm long in adults and is located at the level of the first or second lumbar vertebra (just above the waist).</li>
          <li>Surgeons carefully clamp the renal trunk during kidney transplant surgery to stop blood flow while attaching the new kidney.</li>
          <li>Within the renal trunk, the renal vein is usually positioned in front (anterior), the renal artery behind it, and the ureter furthest back (posterior).</li>
          <li>In some people, there can be extra (accessory) renal arteries, so the trunk may contain more than one artery.</li>
        </ul>
      `,
      funFact:
        "The renal trunk is like a ‘plumbing manifold’ – it contains both the pipe bringing dirty blood in and the pipe taking clean blood out, plus the pipe carrying urine away, all in one small bundle!",
      quizQuestion: {
        question: "What three structures are found inside the renal trunk?",
        answer: "The renal artery, renal vein, and ureter.",
      },
    },
    am: {
      title: "የኩላሊት ግንድ (Renal Trunk)",
      description: `
        <p>የኩላሊት ግንድ በሂለም በኩል ወደ ኩላሊት የሚገቡና የሚወጡ ነገሮች ስብስብ ነው። ይህ <strong>የሬናል ደም ወሳጅ ቧንቧን</strong> (ደም የሚያስገባ)፣ <strong>የሬናል ደም መልስ ቧንቧን</strong> (የተጣራ ደም የሚያወጣ) እና <strong>ሽንት ቧንቧን</strong> (ሽንት የሚያወጣ) ያካትታል። ይህ ስብስብ ሁሉንም ነገር አንድ ላይ አያይዞ በሚይዝ ስብ እና ተያያዥ ቲሹ የተከበበ ነው። የኩላሊት ግንድ ኩላሊቱን ከሰውነት ጋር የሚያያይዝ ዘንግ ይመስላል። ያለዚህ ግንድ ኩላሊት ደም ማግኘትም ሆነ ሽንት ማስወገድ አይችልም ነበር።</p>
        <ul>
          <li>የኩላሊት ግንድ በአዋቂዎች ዘንድ ከ2–3 ሳ.ሜ ይረዝማል፤ የሚገኘውም በወገብ አካባቢ በአከርካሪ አጥንት ደረጃ ላይ ነው።</li>
          <li>የኩላሊት ንቅለ ተከላ በሚደረግበት ጊዜ ሐኪሞች አዲሱን ኩላሊት እስኪያያይዙ ድረስ የደም ፍሰቱን ለማቆም የኩላሊት ግንዱን በጥንቃቄ ይዘጋሉ።</li>
          <li>በግንዱ ውስጥ፣ የሬናል ደም መልስ ቧንቧ በፊት በኩል፣ ደም ወሳጅ ቧንቧው መሃል ላይ፣ እንዲሁም ሽንት ቧንቧው በስተጀርባ በኩል ይገኛሉ።</li>
          <li>በአንዳንድ ሰዎች ላይ ተጨማሪ የሬናል ደም ወሳጅ ቧንቧዎች ሊኖሩ ስለሚችሉ፣ ግንዱ ከአንድ በላይ ቧንቧ ሊይዝ ይችላል።</li>
        </ul>
      `,
      funFact:
        "የኩላሊት ግንድ ልክ እንደ ‘የቧንቧ ማገናኛ’ ነው - የቆሸሸ ደም የሚያስገባውን፣ ንጹህ ደም የሚያወጣውን እና ሽንት የሚሸከመውን ቧንቧ በአንድ ላይ ይዟል!",
      quizQuestion: {
        question: "በኩላሊት ግንድ ውስጥ የሚገኙት ሶስቱ ነገሮች ምንድን ናቸው?",
        answer: "የሬናል ደም ወሳጅ ቧንቧ፣ የሬናል ደም መልስ ቧንቧ እና የሽንት ቧንቧ (ureter)።",
      },
    },
  },

  BezierCurve002_venas_0: {
    en: {
      title: "Renal Veins",
      description: `
        <p>The renal veins carry <strong>filtered, deoxygenated blood</strong> away from the kidneys and back toward the heart. After the blood has been cleaned by the nephrons (waste removed and necessary substances reabsorbed), it collects into small veins that merge into larger ones, finally forming the left and right renal veins. The left renal vein is longer than the right because it has to cross the front of the aorta to reach the inferior vena cava (the large vein that returns blood to the heart). The renal veins carry blood that is now free of urea and excess salts, but still low in oxygen.</p>
        <ul>
          <li>The renal veins empty directly into the <strong>inferior vena cava</strong>, which is the main vein bringing blood from the lower body back to the heart.</li>
          <li>Blood in the renal veins has lower pressure than blood in the renal arteries because most of the filtration pressure is lost in the glomeruli.</li>
          <li>The right renal vein is very short (about 1 cm) because the right kidney sits close to the inferior vena cava.</li>
          <li>Unlike the renal artery, the renal vein does not have a pulse – you can feel the difference if you could touch them during surgery.</li>
        </ul>
      `,
      funFact:
        "The left renal vein is almost three times longer than the right one – it has to travel across your spine to reach the vena cava, while the right renal vein is just a short hop!",
      quizQuestion: {
        question:
          "Does the renal vein carry blood toward the heart or away from the heart?",
        answer: "Toward the heart (it returns filtered blood).",
      },
    },
    am: {
      title: "የኩላሊት ደም መልስ ቧንቧዎች (Renal Veins)",
      description: `
        <p>የኩላሊት ደም መልስ ቧንቧዎች <strong>የተጣራና ኦክስጅኑ ያለቀበትን</strong> ደም ከኩላሊት ወደ ልብ ይመልሳሉ። ደሙ በኔፍሮን ከጸዳ በኋላ ወደ ትናንሽ ደም ሥሮች ይሰበሰባል፤ በመጨረሻም የግራና የቀኝ ሬናል ደም መልስ ቧንቧዎችን ይፈጥራል። የግራው ሬናል ደም መልስ ቧንቧ ከቀኝኛው ይረዝማል፤ ምክንያቱም አኦርታን አቋርጦ ኢንፊሪየር ቬና ካቫ (ደምን ወደ ልብ የሚመልሰው ትልቁ ቧንቧ) ጋር መድረስ ስላለበት ነው። እነዚህ ቧንቧዎች የሚሸከሙት ደም ከዩሪያና ከትርፍ ጨው የጸዳ ቢሆንም፣ ኦክስጅኑ ግን አነስተኛ ነው።</p>
        <ul>
          <li>የሬናል ደም መልስ ቧንቧዎች በቀጥታ ወደ <strong>ኢንፊሪየር ቬና ካቫ</strong> ይገባሉ፤ ይህም ከታችኛው የሰውነት ክፍል ደምን ወደ ልብ የሚወስድ ዋና ቧንቧ ነው።</li>
          <li>በሬናል ደም መልስ ቧንቧዎች ውስጥ ያለው የደም ግፊት ከደም ወሳጅ ቧንቧዎች ያነሰ ነው፤ ምክንያቱም አብዛኛው ግፊት በማጣራት ሂደት ውስጥ ስለሚቀንስ ነው።</li>
          <li>የቀኝ ሬናል ደም መልስ ቧንቧ በጣም አጭር (1 ሳ.ሜ አካባቢ) ነው፤ ምክንያቱም ቀኝ ኩላሊት ለቬና ካቫ ቅርብ ነው።</li>
          <li>እንደ ደም ወሳጅ ቧንቧ ሳይሆን፣ ደም መልስ ቧንቧ ትርታ (pulse) የለውም።</li>
        </ul>
      `,
      funFact:
        "የግራ ሬናል ደም መልስ ቧንቧ ከቀኝኛው በሶስት እጥፍ ያህል ይረዝማል - ቬና ካቫ ጋር ለመድረስ አከርካሪዎን አቋርጦ መሄድ አለበት!",
      quizQuestion: {
        question: "የሬናል ደም መልስ ቧንቧ ደምን ወደ ልብ ይወስዳል ወይንስ ከልብ ያርቃል?",
        answer: "ወደ ልብ ይወስዳል (የተጣራ ደም ይመልሳል)።",
      },
    },
  },

  Icosphere_PiramideRenal_0: {
    en: {
      title: "Renal Pyramid",
      description: `
        <p>A renal pyramid is a cone‑shaped structure located in the <strong>renal medulla</strong> (the inner part of the kidney). Each kidney contains 8 to 18 pyramids. The base of each pyramid faces the outer cortex, and the tip (called the <strong>renal papilla</strong>) points inward toward the renal pelvis. The pyramids are made of parallel bundles of tiny tubes called <strong>collecting ducts</strong> and loops of Henle. These tubes carry urine from the cortex down to the papillae, where urine drips into small cups (calyces) before entering the ureter. The pyramids are what give the medulla its striped appearance.</p>
        <ul>
          <li>Between each pyramid are extensions of the cortex called <strong>renal columns</strong> (of Bertin) – they contain blood vessels that supply the medulla.</li>
          <li>The urine concentration process mostly happens inside the pyramids – that’s why they are striped; the stripes are alternating sections of water‑absorbing and salt‑absorbing tubes.</li>
          <li>In some animals (like rats), only one pyramid exists – humans have multiple to increase surface area for reabsorption.</li>
          <li>The renal pyramids are very sensitive to lack of oxygen; if blood flow drops, they can be damaged faster than the cortex.</li>
        </ul>
      `,
      funFact:
        "The striped appearance of renal pyramids is so distinctive that on a cut‑open kidney you can see them with the naked eye – they look like triangular, pale stripes radiating from the center!",
      quizQuestion: {
        question: "What is the function of the renal pyramids?",
        answer:
          "They contain collecting ducts that move urine from the cortex to the renal pelvis.",
      },
    },
    am: {
      title: "ሬናል ፒራሚድ (Renal Pyramid)",
      description: `
        <p>ሬናል ፒራሚድ በኩላሊቱ የውስጥ ክፍል (ሬናል ሜዱላ) ውስጥ የሚገኝ የሾጣጣ ቅርጽ ያለው አካል ነው። እያንዳንዱ ኩላሊት ከ8 እስከ 18 የሚደርሱ ፒራሚዶችን ይይዛል። የፒራሚዱ ሰፊው ክፍል ወደ ውጪኛው ኮርቴክስ ሲመለከት፣ ጫፉ (ሬናል ፓፒላ) ደግሞ ወደ ኩላሊቱ መሃል ይመለከታል። ፒራሚዶቹ <strong>ኮሌክቲንግ ደክት</strong> በሚባሉ ጥቃቅን ቧንቧዎች የተሰሩ ናቸው። እነዚህ ቧንቧዎች ሽንትን ከኮርቴክስ ወደ ታች በማጓጓዝ ወደ ሽንት ቧንቧው እንዲፈስ ያደርጋሉ። ፒራሚዶቹ ለሜዱላው የተሰመረ (striped) መልክ ይሰጡታል።</p>
        <ul>
          <li>በእያንዳንዱ ፒራሚድ መካከል ሬናል ኮለም የሚባሉ የኮርቴክስ ክፍሎች ይገኛሉ፤ እነዚህም ለሜዱላው ደም የሚያደርሱ ቧንቧዎችን ይይዛሉ።</li>
          <li>የሽንት የማድመቅ (concentration) ሂደት የሚካሄደው በፒራሚዶቹ ውስጥ ነው፤ የተሰመረ መልክ እንዲኖራቸው ያደረገውም እነዚህ ውሃና ጨው የሚመጥጡ ቧንቧዎች ናቸው።</li>
          <li>እንደ አይጥ ባሉ አንዳንድ እንስሳት ውስጥ አንድ ፒራሚድ ብቻ ሲኖር፣ በሰዎች ላይ ግን የመምጠጥ አቅምን ለመጨመር ብዙ ፒራሚዶች አሉ።</li>
          <li>ሬናል ፒራሚዶች ለኦክስጅን እጥረት በጣም ስሜታዊ ናቸው፤ የደም ፍሰት ከቀነሰ ከኮርቴክስ በበለጠ ፍጥነት ሊጎዱ ይችላሉ።</li>
        </ul>
      `,
      funFact:
        "የሬናል ፒራሚዶች የተሰመረ መልክ በጣም ግልጽ ከመሆኑ የተነሳ፣ ኩላሊቱ ሲሰነጠቅ በአይን ማየት ይቻላል - ከመሃል የሚወጡ ባለ ሶስት ማዕዘን ቅርጽ ያላቸው መስመሮች ይመስላሉ!",
      quizQuestion: {
        question: "የሬናል ፒራሚዶች ተግባር ምንድን ነው?",
        answer: "ሽንትን ከኮርቴክስ ወደ ሬናል ፔልቪስ (renal pelvis) የሚያጓጉዙ ቧንቧዎችን መያዝ ነው።",
      },
    },
  },
};

//  Update function for the information panel based on interaction with the organ parts
function updateInfoPanel(name) {
  const title = document.getElementById("organ-title");
  const desc = document.getElementById("part-description");

  // const data =
  //   selectedOrgan === "kidneys" ? kidneyOrganData[name] : organData[name];
  let data;

  if (selectedOrgan === "heart") {
    data = organData[name];
  } else if (selectedOrgan === "kidneys") {
    data = kidneyOrganData[name];
  }

  if (data) {
    data = isAmharic() ? data.am : data.en;
  }

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
       <h3>${isAmharic() ? "መግለጫ" : "Description"}</h3>
        ${data.description}
      </div>

      <div class="section-card fact-card">
       <h3>${isAmharic() ? "አስደናቂ እውነታ" : "Fun Fact"}</h3>
        <p class="fact-text">${data.funFact}</p>
      </div>

      <div class="section-card quiz-card">
        <h3>${isAmharic() ? "ፈጣን ጥያቄ" : "Quick Quiz"}</h3>
        <p><strong>${data.quizQuestion.question}</strong></p>

        <button class="quiz-btn" onclick="showAnswer('${name}')">
         ${isAmharic() ? "መልስ አሳይ" : "Show Answer"}
        </button>

        <div id="quiz-answer"></div>
      </div>

    </div>
  `;
}

function showAnswer(name) {
  const answerBox = document.getElementById("quiz-answer");

  let data;

  if (selectedOrgan === "heart") {
    data = organData[name];
  } else if (selectedOrgan === "kidneys") {
    data = kidneyOrganData[name];
  }

  if (!data) return;

  // get selected language version
  data = isAmharic() ? data.am : data.en;

  if (!data || !data.quizQuestion) return;

  answerBox.innerHTML = `
    <div class="answer-box">
      ${data.quizQuestion.answer}
    </div>
  `;
}

window.showAnswer = showAnswer;

// Zoom function with orthographic projection support for 2D view mode
function adjustZoom(v) {
  if (currentViewMode === "2d") {
    orthoCamera.zoom = THREE.MathUtils.clamp(orthoCamera.zoom * v, 0.5, 6);
    orthoCamera.updateProjectionMatrix();
    return;
  }

  camera.position.multiplyScalar(1 / v);
}

window.adjustZoom = adjustZoom;

// Handle window zise changes to maintain correct aspect ratio and camera settings
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

// Animate function to continuously render the scene and update animations
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer && animationPlaying) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, activeCamera);
}

// To show some overview infn'. about the organ when it is first loaded
showOrganOverview(selectedOrgan);

animate();
