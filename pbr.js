(function () {
  const modelSelect = document.getElementById("modelSelect");
  const sceneControlsContainer = document.getElementById("sceneControls");
  const materialControlsContainer = document.getElementById("materialControls");
  const resetParamsButton = document.getElementById("resetParamsButton");
  const docContent = document.getElementById("pbrDocContent");
  const gpuStatusBadge = document.getElementById("gpuStatusBadge");
  const stageHint = document.getElementById("pbrStageHint");
  const toggleControlsButton = document.getElementById("toggleControlsButton");
  const controlPanel = document.getElementById("pbrControlPanel");
  const controlPanelTitle = document.getElementById("controlPanelTitle");
  const canvas = document.getElementById("pbrCanvas");
  const canvasShell = document.getElementById("pbrCanvasShell");
  const fallback = document.getElementById("pbrFallback");

  if (
    !modelSelect ||
    !sceneControlsContainer ||
    !materialControlsContainer ||
    !resetParamsButton ||
    !docContent ||
    !gpuStatusBadge ||
    !stageHint ||
    !toggleControlsButton ||
    !controlPanel ||
    !controlPanelTitle ||
    !canvas ||
    !canvasShell ||
    !fallback
  ) {
    return;
  }

  const PI = Math.PI;
  const SCENE_KEYS = ["lightIntensity", "lightAzimuth", "lightElevation", "exposure"];
  const DEFAULT_STAGE_HINT =
    "拖拽球体旋转视角；左上角可显示或隐藏参数面板；详细解释固定在右侧教学面板中。";

  const PARAM_DEFS = {
    baseColor: {
      type: "color",
      label: "Base Color / Albedo",
      default: "#C76B47",
      hint: "定义漫反射或基础反照率，是材质颜色最直观的入口。",
    },
    specularColor: {
      type: "color",
      label: "Specular Color",
      default: "#F7F3FF",
      hint: "经验模型里的高光颜色，用于观察镜面层与底色的分离。",
    },
    roughness: {
      type: "range",
      label: "Roughness",
      min: 0.04,
      max: 1,
      step: 0.01,
      default: 0.28,
      hint: "控制微表面法线分布，越大越粗糙，高光越宽越散。",
    },
    metallic: {
      type: "range",
      label: "Metallic",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.1,
      hint: "在非金属漫反射和金属有色镜面之间做插值。",
    },
    fresnelF0: {
      type: "range",
      label: "Fresnel F0",
      min: 0.02,
      max: 1,
      step: 0.01,
      default: 0.04,
      hint: "法线入射时的反射率，是 Fresnel 曲线的起点。",
    },
    specularLevel: {
      type: "range",
      label: "Specular",
      min: 0,
      max: 1.5,
      step: 0.01,
      default: 1,
      hint: "工程化镜面强度缩放，用来观察高光灵敏度。",
    },
    shininess: {
      type: "range",
      label: "Shininess",
      min: 4,
      max: 256,
      step: 1,
      default: 64,
      hint: "Phong / Blinn-Phong 的经验高光指数，越大越尖锐。",
    },
    lightIntensity: {
      type: "range",
      label: "Light Intensity",
      min: 0.2,
      max: 8,
      step: 0.05,
      default: 3.6,
      hint: "主方向光强度，会直接影响高光和明暗对比。",
    },
    lightAzimuth: {
      type: "range",
      label: "Light Azimuth",
      min: -180,
      max: 180,
      step: 1,
      default: 32,
      hint: "控制主光在水平面上的方向，便于观察高光移动。",
    },
    lightElevation: {
      type: "range",
      label: "Light Elevation",
      min: 10,
      max: 85,
      step: 1,
      default: 38,
      hint: "控制主光仰角，决定亮斑与明暗交界线的位置。",
    },
    exposure: {
      type: "range",
      label: "Exposure",
      min: 0.5,
      max: 2.2,
      step: 0.01,
      default: 1,
      hint: "对最终输出做整体曝光映射，帮助观察模型差异。",
    },
  };

  const COMMON_PARAMETER_NOTES = {
    lightIntensity: {
      key: "lightIntensity",
      title: "Light Intensity",
      meaning: "主方向光的辐射强度缩放。",
      visual: "增大后高光更亮、阴影与受光面的反差更明显。",
      coupling: "与 exposure 一起影响最终亮度感受，但不改变 BRDF 的形状。",
    },
    lightAzimuth: {
      key: "lightAzimuth",
      title: "Light Azimuth",
      meaning: "主光在水平面上的方位角。",
      visual: "改变它可以观察高光如何沿球面滑动。",
      coupling: "常与 lightElevation 一起使用，用于理解光源方向和半角向量变化。",
    },
    lightElevation: {
      key: "lightElevation",
      title: "Light Elevation",
      meaning: "主光相对水平面的高度角。",
      visual: "增大后高光更靠近球顶，暗部面积也会变化。",
      coupling: "和 lightAzimuth 共同决定当前材质球的受光分布。",
    },
    exposure: {
      key: "exposure",
      title: "Exposure",
      meaning: "后处理阶段的整体曝光缩放。",
      visual: "主要影响亮度和对比度，不改变模型的相对高光结构。",
      coupling: "与 lightIntensity 都会影响亮度，但 exposure 更接近显示映射。",
    },
  };

  const MODELS = [
    {
      id: "lambert",
      selectLabel: "Lambert",
      name: "Lambert Diffuse Model",
      subtitle: "理想漫反射基线模型",
      family: "Surface Reflection / Diffuse BRDF",
      shaderMode: 0,
      controls: ["baseColor"],
      defaults: {
        baseColor: "#C76B47",
        lightIntensity: 3.3,
        lightAzimuth: 28,
        lightElevation: 40,
        exposure: 1.02,
      },
      oneLiner: "把表面视为各向同性的理想漫反射体，所有出射方向共享同一漫反射 BRDF 常数。",
      coreIdea:
        "Lambert 的核心假设是：表面的微观结构足够随机，单位面积上的漫反射能量会均匀地散向所有方向。于是 BRDF 可以简化成常数 c / π，并天然满足能量守恒。",
      scopeNote:
        "这是理解 PBR 的起点。它没有视角相关高光，因此非常适合拿来和经验高光模型或微表面模型做对比。",
      stageHint: "Lambert 只保留漫反射基线，适合先观察 base color 与入射角余弦关系。",
      formulas: [
        {
          title: "Diffuse BRDF",
          tex: "f_d(l,v) = \\frac{c_{base}}{\\pi}",
          explanation: "Lambert 假设 BRDF 与观察方向无关，因此漫反射项是一个常数。",
        },
        {
          title: "Outgoing Radiance",
          tex: "L_o = \\frac{c_{base}}{\\pi}\\,L_i\\,(n\\cdot l)",
          explanation: "最终亮度完全由 base color、入射光强和余弦项决定。",
        },
      ],
      formulaTerms: [
        {
          key: "baseColor",
          symbol: "c_{base}",
          meaning: "表面反照率，决定材质的漫反射颜色。",
        },
        {
          key: "lightIntensity",
          symbol: "L_i",
          meaning: "入射光能量强度，这里用方向光近似。",
        },
      ],
      intuition:
        "如果你只看得到球面明暗，而看不到任何镜面高光或视角相关变化，那么你看到的基本就是 Lambert 的世界。它像一张干净的基线图，用来解释为什么更复杂的模型需要再加额外项。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Albedo",
          meaning: "表示表面对漫反射能量的反照率。",
          visual: "颜色变化会直接改变受光区域的色调，但高光形态不会改变，因为 Lambert 没有镜面项。",
          coupling: "与 lightIntensity 线性耦合，是最容易建立视觉直觉的一组参数。",
        },
      ],
      pros: [
        "形式极其简单，是几乎所有更复杂表面模型的教学基线。",
        "天然能量守恒，漫反射解释直观。",
        "在实时渲染里计算代价极低。",
      ],
      cons: [
        "无法描述高光、菲涅耳和粗糙度等视角相关现象。",
        "面对金属、塑料、漆面等材质时真实感明显不足。",
      ],
      useCases: [
        "教学中的漫反射基线模型",
        "对比实验：观察额外镜面项究竟带来什么变化",
        "对真实感要求不高的简化实时着色",
      ],
    },
    {
      id: "phong",
      selectLabel: "Phong",
      name: "Phong Specular Model",
      subtitle: "基于反射向量的经验高光",
      family: "Surface Reflection / Empirical BRDF",
      shaderMode: 1,
      controls: ["baseColor", "specularColor", "shininess"],
      defaults: {
        baseColor: "#7A86C8",
        specularColor: "#F6F4FF",
        shininess: 72,
        lightIntensity: 3.6,
        lightAzimuth: 30,
        lightElevation: 34,
        exposure: 1.03,
      },
      oneLiner: "在 Lambert 漫反射上叠加一个以反射向量为中心的经验高光峰，适合快速展示高光形状。",
      coreIdea:
        "Phong 用反射向量 r 与观察方向 v 的夹角来决定镜面高光强弱。高光指数越大，峰值越尖锐；指数越小，高光越宽。",
      scopeNote:
        "它不是严格物理模型，但非常适合教学，因为高光是直接由一个幂函数控制的，参数直觉很强。",
      stageHint: "Phong 通过反射向量构造高光，shininess 增大会让高光峰更尖锐更集中。",
      formulas: [
        {
          title: "Empirical BRDF",
          tex: "f_r = k_d\\frac{c_{base}}{\\pi} + k_s\\,(r\\cdot v)^n",
          explanation: "Phong 由漫反射基线和一个经验镜面峰组合而成。",
        },
        {
          title: "Reflection Vector",
          tex: "r = 2(n\\cdot l)n - l",
          explanation: "反射向量 r 定义了高光峰的中心方向。",
        },
      ],
      formulaTerms: [
        {
          key: "baseColor",
          symbol: "c_{base}",
          meaning: "决定漫反射基底颜色。",
        },
        {
          key: "specularColor",
          symbol: "k_s",
          meaning: "镜面高光颜色和强度。",
        },
        {
          key: "shininess",
          symbol: "n",
          meaning: "高光指数，决定经验高光峰宽度。",
        },
      ],
      intuition:
        "Phong 的高光像是把一个聚焦手电筒贴在反射方向上。只要相机更接近镜面反射方向，亮斑就会迅速跳出来，这让它很适合说明高光为什么是视角相关的。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Albedo",
          meaning: "漫反射底色，类似 Lambert 的反照率。",
          visual: "决定球面非高光区域的整体颜色。",
          coupling: "在 Phong 中通常与 specularColor 独立控制，便于观察漫反射和镜面项分离。",
        },
        {
          key: "specularColor",
          title: "Specular Color",
          meaning: "经验镜面高光颜色。",
          visual: "增大后高光更明亮，颜色也会更接近输入的 specular tint。",
          coupling: "与 shininess 一起控制亮斑的亮度和集中程度。",
        },
        {
          key: "shininess",
          title: "Shininess",
          meaning: "经验高光幂指数。",
          visual: "增大时高光变尖、边界更利；减小时高光会扩散成更大亮斑。",
          coupling: "和 specularColor 经常共同调节，避免高光既大又过曝。",
        },
      ],
      pros: [
        "形式简单，参数直觉强，很适合作为高光教学模型。",
        "容易实现，传统实时渲染里使用广泛。",
      ],
      cons: [
        "不严格能量守恒，对粗糙表面的高光尾部拟合较差。",
        "与现代 PBR 的 roughness、metallic 语义并不一致。",
      ],
      useCases: [
        "传统图形管线教学",
        "经验高光模型对比演示",
        "老式或兼容性优先的实时渲染方案",
      ],
    },
    {
      id: "blinn-phong",
      selectLabel: "Blinn-Phong",
      name: "Blinn-Phong Specular Model",
      subtitle: "基于半角向量的经验高光",
      family: "Surface Reflection / Empirical BRDF",
      shaderMode: 2,
      controls: ["baseColor", "specularColor", "shininess"],
      defaults: {
        baseColor: "#4A9E89",
        specularColor: "#FFFFFF",
        shininess: 120,
        lightIntensity: 3.8,
        lightAzimuth: 30,
        lightElevation: 37,
        exposure: 1.01,
      },
      oneLiner: "把高光峰从反射向量空间改写到半角向量空间，使高光位置和形状在实时实现中更稳定。",
      coreIdea:
        "Blinn-Phong 用半角向量 h = normalize(l + v) 替代反射向量 r，并用 (n·h)^n 描述高光峰值。这样在实时实现中更方便，也更容易与后来的微表面模型建立联系。",
      scopeNote:
        "它仍然是经验模型，但已经更接近法线分布 + 半角向量的现代直觉，因此是通向 Cook-Torrance 的好桥梁。",
      stageHint: "Blinn-Phong 用半角向量控制高光，是从传统经验模型过渡到微表面直觉的重要桥梁。",
      formulas: [
        {
          title: "Empirical BRDF",
          tex: "f_r = k_d\\frac{c_{base}}{\\pi} + k_s\\,(n\\cdot h)^n",
          explanation: "把镜面项直接写在法线与半角向量之间，更适合实时实现。",
        },
        {
          title: "Half Vector",
          tex: "h = \\frac{l + v}{\\|l + v\\|}",
          explanation: "半角向量代表光线与观察方向的中间方向。",
        },
      ],
      formulaTerms: [
        {
          key: "specularColor",
          symbol: "k_s",
          meaning: "镜面高光强度和颜色。",
        },
        {
          key: "shininess",
          symbol: "n",
          meaning: "经验指数，用来调节高光峰的尖锐程度。",
        },
      ],
      intuition:
        "如果 Phong 是盯着反射方向找亮斑，那么 Blinn-Phong 更像在问：法线有没有和光线与视线的中间方向对齐。这个视角很重要，因为微表面理论本质上也是在研究半角向量的统计分布。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Albedo",
          meaning: "漫反射底色，用来提供非高光部分的能量。",
          visual: "主导暗部与半明部颜色，便于和高光层分离观察。",
          coupling: "在经验模型里通常独立于 specularColor。",
        },
        {
          key: "specularColor",
          title: "Specular Color",
          meaning: "Blinn-Phong 镜面高光颜色。",
          visual: "会直接影响高光 tint，尤其在彩色高光实验里很明显。",
          coupling: "与 shininess 同时决定亮斑的亮度和视觉焦点。",
        },
        {
          key: "shininess",
          title: "Shininess",
          meaning: "控制半角高光峰宽度的经验指数。",
          visual: "数值越大，高光越集中且更像抛光表面。",
          coupling: "和光源方向一起决定高光移动速度与集中度。",
        },
      ],
      pros: [
        "比 Phong 更容易和半角向量、微表面分布联系起来。",
        "实现简单，仍然有很强的教学可读性。",
      ],
      cons: [
        "仍然不是严格物理模型，参数与现代 PBR 的 roughness 语义不同。",
        "高光尾部和能量分布与真实材料存在偏差。",
      ],
      useCases: [
        "作为传统经验模型与微表面模型之间的过渡讲解",
        "轻量实时渲染或兼容旧管线",
        "教学中比较 r·v 与 n·h 两种高光构造方式",
      ],
    },
    {
      id: "ggx",
      selectLabel: "Cook-Torrance (GGX)",
      name: "Cook-Torrance BRDF with GGX NDF",
      subtitle: "现代实时 PBR 的微表面核心模型",
      family: "Surface Reflection / Microfacet BRDF",
      shaderMode: 3,
      controls: ["baseColor", "roughness", "metallic", "specularLevel", "fresnelF0"],
      defaults: {
        baseColor: "#B88752",
        roughness: 0.24,
        metallic: 0.72,
        specularLevel: 1,
        fresnelF0: 0.06,
        lightIntensity: 4.2,
        lightAzimuth: 36,
        lightElevation: 42,
        exposure: 1.05,
      },
      oneLiner:
        "用微表面法线分布 D、阴影遮蔽项 G 和 Fresnel 项 F 共同构成镜面反射，是现代实时 PBR 的主流镜面模型。",
      coreIdea:
        "Cook-Torrance 把表面看成由大量微小镜面组成。GGX 则是其中常见的法线分布函数 NDF，因为它能给出更自然的长尾高光，特别适合粗糙金属和现代游戏渲染。",
      scopeNote:
        "这一页里的 GGX 版本已经把 roughness、metallic、F0 和环境反射近似都接进同一个 shader，是现代 PBR 语义最完整的一组参数。",
      stageHint:
        "GGX 把高光宽度、Fresnel 和金属度都统一起来，是理解现代 PBR 参数化的关键模型。",
      formulas: [
        {
          title: "Cook-Torrance BRDF",
          tex: "f_r(l,v) = \\frac{D_{GGX}(h)\\,G(l,v,h)\\,F(v,h)}{4(n\\cdot l)(n\\cdot v)} + k_d\\frac{c_{base}}{\\pi}",
          explanation: "镜面项由微表面统计决定，漫反射项则用能量剩余部分承接。",
        },
        {
          title: "GGX NDF",
          tex: "D_{GGX}(h) = \\frac{\\alpha^2}{\\pi\\left[(n\\cdot h)^2(\\alpha^2-1)+1\\right]^2}",
          explanation: "粗糙度经过重参数化后成为微表面分布宽度。",
        },
        {
          title: "Schlick Fresnel",
          tex: "F(v,h) = F_0 + (1 - F_0)(1 - v\\cdot h)^5",
          explanation: "Fresnel 让掠射角反射增强，是现代 PBR 视觉差异的关键来源之一。",
        },
      ],
      formulaTerms: [
        {
          key: "roughness",
          symbol: "\\alpha",
          meaning: "微表面粗糙度，决定高光峰宽度与环境反射清晰度。",
        },
        {
          key: "fresnelF0",
          symbol: "F_0",
          meaning: "法线入射时的镜面反射率，是 Fresnel 的基底。",
        },
        {
          key: "metallic",
          symbol: "k_d,\\,metallic",
          meaning: "决定漫反射是否衰减、镜面是否着色成金属反射。",
        },
      ],
      intuition:
        "可以把 GGX 想成统计很多微小镜片朝向的模型。roughness 控制这些小镜片有多乱，Fresnel 控制斜着看时为什么更亮，metallic 决定镜面颜色是白色介电体还是有色金属反射。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Albedo",
          meaning: "非金属时主要影响漫反射颜色，金属时会逐渐转而控制镜面反射 tint。",
          visual: "在 metallic 较高时，球体高光和环境反射会更接近 base color。",
          coupling: "与 metallic 强耦合，是现代 PBR 最重要的一组参数之一。",
        },
        {
          key: "roughness",
          title: "Roughness",
          meaning: "微表面法线分布宽度；这里在 shader 中进一步映射为 GGX 的 α。",
          visual: "增大后高光变宽、峰值下降、环境反射更模糊。",
          coupling: "会同时影响 D 项、G 项和环境反射清晰度，是感知最明显的微表面参数。",
        },
        {
          key: "metallic",
          title: "Metallic",
          meaning: "在介电体与导体之间做插值。",
          visual: "增大后漫反射会减少，高光颜色会逐渐染上 base color。",
          coupling: "与 baseColor、F0 共同决定镜面颜色与漫反射能量分配。",
        },
        {
          key: "fresnelF0",
          title: "Fresnel F0",
          meaning: "法线入射时的镜面反射率，决定介电体的基础反射水平。",
          visual: "增大后正视角下也会更亮，边缘反射会更早抬升。",
          coupling: "与 specularLevel 一起决定镜面底值，但掠射角增强仍由 Fresnel 主导。",
        },
        {
          key: "specularLevel",
          title: "Specular",
          meaning: "工程化镜面强度因子，用来辅助教学时观察 F0 放大后的视觉变化。",
          visual: "增大后整个镜面反射层更明显，尤其在非金属时效果突出。",
          coupling: "与 fresnelF0 有耦合；教学中建议两者分开调，先观察 F0 再观察强度缩放。",
        },
      ],
      pros: [
        "能量分配、视角相关反射和粗糙度语义都更接近真实材料。",
        "roughness / metallic / F0 的参数化已经成为现代实时 PBR 的事实标准。",
        "和环境反射、材质库工作流配合良好。",
      ],
      cons: [
        "实现和理解门槛更高，参数之间也更容易产生耦合误解。",
        "如果要做严格 IBL、可见性和多重散射补偿，工程细节会明显增多。",
      ],
      useCases: [
        "现代游戏实时渲染",
        "材质编辑器和资产预览球",
        "PBR 教学中解释 roughness / metallic / F0 的标准案例",
      ],
    },
  ];

  const MODEL_MAP = Object.fromEntries(MODELS.map((model) => [model.id, model]));
  const modelParamCache = {};

  const state = {
    modelId: "ggx",
    params: {},
    highlightedParam: null,
    controlsVisible: true,
    orbitYaw: 0.55,
    orbitPitch: 0.14,
  };

  for (const [key, def] of Object.entries(PARAM_DEFS)) {
    state.params[key] = def.default;
  }

  function getCurrentModel() {
    return MODEL_MAP[state.modelId];
  }

  function formatValue(key, value) {
    const def = PARAM_DEFS[key];
    if (!def) {
      return String(value);
    }
    if (def.type === "color") {
      return String(value).toUpperCase();
    }
    if (key === "lightAzimuth" || key === "lightElevation" || key === "shininess") {
      return `${Math.round(Number(value))}`;
    }
    return Number(value).toFixed(2);
  }

  function hexToLinearRgb(hex) {
    const normalized = String(hex).replace("#", "");
    const full = normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

    return [0, 2, 4].map((offset) => {
      const srgb = parseInt(full.slice(offset, offset + 2), 16) / 255;
      return srgb <= 0.04045
        ? srgb / 12.92
        : Math.pow((srgb + 0.055) / 1.055, 2.4);
    });
  }

  function lightDirectionFromAngles(azimuthDeg, elevationDeg) {
    const azimuth = (Number(azimuthDeg) * PI) / 180;
    const elevation = (Number(elevationDeg) * PI) / 180;
    const cosElevation = Math.cos(elevation);

    return [
      Math.sin(azimuth) * cosElevation,
      Math.sin(elevation),
      Math.cos(azimuth) * cosElevation,
    ];
  }

  function getDefaultMaterialParams(modelId) {
    const model = MODEL_MAP[modelId];
    const defaults = {};

    for (const key of model.controls) {
      defaults[key] = model.defaults[key] ?? PARAM_DEFS[key].default;
    }

    return defaults;
  }

  function getSceneDefaults(modelId) {
    const model = MODEL_MAP[modelId];
    const defaults = {};

    for (const key of SCENE_KEYS) {
      defaults[key] = model.defaults[key] ?? PARAM_DEFS[key].default;
    }

    return defaults;
  }

  function cacheCurrentModelParams() {
    const model = getCurrentModel();
    modelParamCache[model.id] = {};

    for (const key of model.controls) {
      modelParamCache[model.id][key] = state.params[key];
    }
  }

  function applyModelSelection(nextModelId) {
    if (MODEL_MAP[state.modelId] && nextModelId !== state.modelId) {
      cacheCurrentModelParams();
    }

    state.modelId = nextModelId;

    const materialDefaults = getDefaultMaterialParams(nextModelId);
    const cached = modelParamCache[nextModelId] ?? {};

    for (const key of Object.keys(materialDefaults)) {
      state.params[key] = cached[key] ?? materialDefaults[key];
    }

    controlPanelTitle.textContent = `${getCurrentModel().selectLabel} 参数`;
  }

  function resetCurrentModelParams() {
    const model = getCurrentModel();
    const materialDefaults = getDefaultMaterialParams(model.id);
    const sceneDefaults = getSceneDefaults(model.id);

    for (const [key, value] of Object.entries(sceneDefaults)) {
      state.params[key] = value;
    }

    for (const [key, value] of Object.entries(materialDefaults)) {
      state.params[key] = value;
    }

    modelParamCache[model.id] = { ...materialDefaults };
  }

  function buildControlRow(key) {
    const def = PARAM_DEFS[key];
    const value = state.params[key];
    const formattedValue = formatValue(key, value);

    if (def.type === "color") {
      return `
        <label class="control-row control-row-color" data-param-key="${key}">
          <div class="control-row-top">
            <div class="control-row-title">
              <span>${def.label}</span>
            </div>
            <span class="control-row-value" data-control-value-key="${key}">${formattedValue}</span>
          </div>
          <div class="control-color-line">
            <input
              class="control-color-input"
              type="color"
              data-param-input="${key}"
              value="${value}"
              aria-label="${def.label}"
            />
          </div>
        </label>
      `;
    }

    return `
      <label class="control-row" data-param-key="${key}">
        <div class="control-row-top">
          <div class="control-row-title">
            <span>${def.label}</span>
          </div>
          <span class="control-row-value" data-control-value-key="${key}">${formattedValue}</span>
        </div>
        <input
          class="control-slider"
          type="range"
          data-param-input="${key}"
          aria-label="${def.label}"
          min="${def.min}"
          max="${def.max}"
          step="${def.step}"
          value="${value}"
        />
      </label>
    `;
  }

  function getParameterNoteMap() {
    const model = getCurrentModel();
    const noteMap = {};

    for (const note of model.parameterNotes) {
      noteMap[note.key] = note;
    }

    for (const key of SCENE_KEYS) {
      noteMap[key] = COMMON_PARAMETER_NOTES[key];
    }

    return noteMap;
  }

  function renderControls() {
    const model = getCurrentModel();
    modelSelect.innerHTML = MODELS.map(
      (entry) =>
        `<option value="${entry.id}" ${entry.id === model.id ? "selected" : ""}>${entry.selectLabel}</option>`
    ).join("");

    sceneControlsContainer.innerHTML = SCENE_KEYS.map(buildControlRow).join("");
    materialControlsContainer.innerHTML = model.controls.map(buildControlRow).join("");

    bindControlEvents(sceneControlsContainer);
    bindControlEvents(materialControlsContainer);
    updateDisplayedValues();
  }

  function renderDocs() {
    const model = getCurrentModel();
    const noteMap = getParameterNoteMap();
    const noteKeys = [...model.controls, ...SCENE_KEYS];

    docContent.innerHTML = `
      <article class="pbr-model-hero">
        <div class="pbr-model-hero-copy">
          <p class="section-tag">Current Model</p>
          <h3>${model.name}</h3>
          <p class="pbr-model-subtitle">${model.subtitle}</p>
          <p>${model.oneLiner}</p>
        </div>
        <div class="pbr-model-badges" aria-label="模型标签">
          <span class="pbr-model-badge">${model.family}</span>
          <span class="pbr-model-badge">Shader Mode ${model.shaderMode}</span>
          <span class="pbr-model-badge">Implemented</span>
        </div>
      </article>

      <section class="pbr-doc-section">
        <h3>一句话概括</h3>
        <p>${model.oneLiner}</p>
      </section>

      <section class="pbr-doc-section">
        <h3>核心思想</h3>
        <div class="pbr-callout">
          <p>${model.coreIdea}</p>
        </div>
        <p class="pbr-scope-note">${model.scopeNote}</p>
      </section>

      <section class="pbr-doc-section">
        <h3>数学形式 / 核心公式</h3>
        <div class="pbr-formula-grid">
          ${model.formulas
            .map(
              (formula) => `
                <article class="pbr-formula-card">
                  <p class="formula-title">${formula.title}</p>
                  <div class="math-display">\\[ ${formula.tex} \\]</div>
                  <p class="math-note">${formula.explanation}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="pbr-doc-section">
        <h3>公式解释</h3>
        <div class="pbr-term-list">
          ${model.formulaTerms
            .map(
              (term) => `
                <article class="formula-term-item" data-param-key="${term.key}" tabindex="0">
                  <div class="formula-term-symbol math-inline">\\( ${term.symbol} \\)</div>
                  <div class="formula-term-copy">
                    <h4>${noteMap[term.key]?.title ?? PARAM_DEFS[term.key]?.label ?? term.key}</h4>
                    <p>${term.meaning}</p>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="pbr-doc-section">
        <h3>模型直觉说明</h3>
        <p>${model.intuition}</p>
      </section>

      <section class="pbr-doc-section">
        <h3>参数含义</h3>
        <div class="pbr-param-grid">
          ${noteKeys
            .map((key) => {
              const note = noteMap[key];
              return `
                <article class="pbr-param-card" data-param-key="${key}" tabindex="0">
                  <div class="pbr-param-card-header">
                    <div>
                      <p class="formula-title">${note.title}</p>
                      <h4>${PARAM_DEFS[key].label}</h4>
                    </div>
                    <span class="pbr-current-value" data-current-value-key="${key}">${formatValue(
                      key,
                      state.params[key]
                    )}</span>
                  </div>
                  <dl class="pbr-param-card-meta">
                    <div>
                      <dt>物理意义</dt>
                      <dd>${note.meaning}</dd>
                    </div>
                    <div>
                      <dt>视觉变化</dt>
                      <dd>${note.visual}</dd>
                    </div>
                    <div>
                      <dt>耦合关系</dt>
                      <dd>${note.coupling}</dd>
                    </div>
                  </dl>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>

      <section class="pbr-doc-section">
        <h3>优点与局限</h3>
        <div class="pbr-list-grid">
          <article class="pbr-list-card">
            <p class="formula-title">Pros</p>
            <ul>
              ${model.pros.map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </article>
          <article class="pbr-list-card">
            <p class="formula-title">Cons</p>
            <ul>
              ${model.cons.map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </article>
        </div>
      </section>

      <section class="pbr-doc-section">
        <h3>适用场景</h3>
        <div class="pbr-list-card pbr-list-card-wide">
          <ul>
            ${model.useCases.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      </section>
    `;

    if (typeof window.renderStaticMath === "function") {
      window.renderStaticMath(docContent);
    }

    if (typeof window.bindMathScroll === "function") {
      window.bindMathScroll(docContent);
    }

    if (typeof window.updateMathScrollState === "function") {
      window.updateMathScrollState(docContent);
    }

    bindDocHighlightEvents();
    updateDisplayedValues();
  }

  function updateDisplayedValues() {
    const controlValues = document.querySelectorAll("[data-control-value-key]");
    controlValues.forEach((element) => {
      const key = element.getAttribute("data-control-value-key");
      element.textContent = formatValue(key, state.params[key]);
    });

    const docValues = document.querySelectorAll("[data-current-value-key]");
    docValues.forEach((element) => {
      const key = element.getAttribute("data-current-value-key");
      element.textContent = formatValue(key, state.params[key]);
    });
  }

  function restoreDefaultHints() {
    stageHint.textContent = DEFAULT_STAGE_HINT;
  }

  function setHighlightedParam(key) {
    state.highlightedParam = key;

    document.querySelectorAll("[data-param-key]").forEach((element) => {
      element.classList.toggle("is-highlighted", element.getAttribute("data-param-key") === key);
    });
  }

  function clearHighlightedParam() {
    state.highlightedParam = null;
    document.querySelectorAll("[data-param-key]").forEach((element) => {
      element.classList.remove("is-highlighted");
    });
    restoreDefaultHints();
  }

  function syncControlToggleButton() {
    toggleControlsButton.textContent = state.controlsVisible ? "隐藏参数" : "显示参数";
    toggleControlsButton.setAttribute("aria-expanded", String(state.controlsVisible));
  }

  function setControlsVisibility(nextVisible) {
    state.controlsVisible = Boolean(nextVisible);
    controlPanel.hidden = !state.controlsVisible;
    syncControlToggleButton();
  }

  function bindHighlightLifecycle(element, key) {
    element.addEventListener("mouseenter", () => setHighlightedParam(key));
    element.addEventListener("mouseleave", clearHighlightedParam);
    element.addEventListener("focusin", () => setHighlightedParam(key));
    element.addEventListener("focusout", clearHighlightedParam);
  }

  function bindControlEvents(container) {
    container.querySelectorAll("[data-param-key]").forEach((row) => {
      const key = row.getAttribute("data-param-key");
      bindHighlightLifecycle(row, key);
    });

    container.querySelectorAll("[data-param-input]").forEach((input) => {
      const key = input.getAttribute("data-param-input");
      const def = PARAM_DEFS[key];

      const updateValue = () => {
        state.params[key] = def.type === "color" ? input.value.toUpperCase() : Number(input.value);
        updateDisplayedValues();
        updateRendererState();
      };

      input.addEventListener("input", updateValue);
      input.addEventListener("change", updateValue);
    });
  }

  function bindDocHighlightEvents() {
    docContent.querySelectorAll("[data-param-key]").forEach((element) => {
      const key = element.getAttribute("data-param-key");
      bindHighlightLifecycle(element, key);
    });
  }

  function buildRenderState() {
    return {
      modelMode: getCurrentModel().shaderMode,
      exposure: Number(state.params.exposure),
      baseColor: hexToLinearRgb(state.params.baseColor),
      roughness: Number(state.params.roughness ?? PARAM_DEFS.roughness.default),
      metallic: Number(state.params.metallic ?? PARAM_DEFS.metallic.default),
      specularLevel: Number(state.params.specularLevel ?? PARAM_DEFS.specularLevel.default),
      fresnelF0: Number(state.params.fresnelF0 ?? PARAM_DEFS.fresnelF0.default),
      shininess: Number(state.params.shininess ?? PARAM_DEFS.shininess.default),
      lightDirection: lightDirectionFromAngles(state.params.lightAzimuth, state.params.lightElevation),
      lightIntensity: Number(state.params.lightIntensity),
      specularColor: hexToLinearRgb(state.params.specularColor ?? PARAM_DEFS.specularColor.default),
      orbitYaw: state.orbitYaw,
      orbitPitch: state.orbitPitch,
    };
  }

  class WebGPUPBRRenderer {
    constructor(canvasElement, hostElement) {
      this.canvas = canvasElement;
      this.host = hostElement;
      this.sizeTarget = hostElement;
      this.context = null;
      this.device = null;
      this.pipeline = null;
      this.uniformBuffer = null;
      this.bindGroup = null;
      this.format = null;
      this.isConfigured = false;
      this.uniformData = new Float32Array(24);
      this.sceneState = null;
      this.resizeObserver = null;
      this.animationFrameId = 0;
    }

    async init() {
      if (!("gpu" in navigator)) {
        throw new Error("WebGPU not supported");
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No GPU adapter");
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext("webgpu");
      if (!this.context) {
        throw new Error("WebGPU canvas context unavailable");
      }

      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.uniformBuffer = this.device.createBuffer({
        size: this.uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const shaderModule = this.device.createShaderModule({
        code: `
          struct Uniforms {
            resolutionModelExposure : vec4<f32>,
            baseColorRoughness : vec4<f32>,
            metallicSpecularF0Shininess : vec4<f32>,
            lightDirIntensity : vec4<f32>,
            specularColorOrbitYaw : vec4<f32>,
            orbitPitchPadding : vec4<f32>,
          };

          @group(0) @binding(0) var<uniform> uniforms : Uniforms;

          struct VertexOut {
            @builtin(position) position : vec4<f32>,
          };

          @vertex
          fn vsMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
            var positions = array<vec2<f32>, 3>(
              vec2<f32>(-1.0, -1.0),
              vec2<f32>(3.0, -1.0),
              vec2<f32>(-1.0, 3.0)
            );

            var output : VertexOut;
            output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
            return output;
          }

          fn saturate1(value : f32) -> f32 {
            return clamp(value, 0.0, 1.0);
          }

          fn skyColor(direction : vec3<f32>) -> vec3<f32> {
            let upBlend = saturate1(direction.y * 0.5 + 0.5);
            let skyTop = vec3<f32>(0.62, 0.73, 0.88);
            let skyHorizon = vec3<f32>(0.92, 0.95, 0.98);
            let ground = vec3<f32>(0.12, 0.13, 0.15);
            let sky = mix(skyHorizon, skyTop, pow(upBlend, 1.35));
            return mix(ground, sky, smoothstep(-0.25, 0.15, direction.y));
          }

          fn environmentSpecular(direction : vec3<f32>, lightDir : vec3<f32>) -> vec3<f32> {
            let base = skyColor(direction);
            let sun = pow(max(dot(direction, lightDir), 0.0), 220.0);
            return base + vec3<f32>(1.0, 0.95, 0.88) * sun * 2.2;
          }

          fn rotateY(value : vec3<f32>, angle : f32) -> vec3<f32> {
            let c = cos(angle);
            let s = sin(angle);
            return vec3<f32>(c * value.x + s * value.z, value.y, -s * value.x + c * value.z);
          }

          fn rotateX(value : vec3<f32>, angle : f32) -> vec3<f32> {
            let c = cos(angle);
            let s = sin(angle);
            return vec3<f32>(value.x, c * value.y - s * value.z, s * value.y + c * value.z);
          }

          fn intersectSphere(rayOrigin : vec3<f32>, rayDir : vec3<f32>) -> f32 {
            let oc = rayOrigin;
            let b = dot(oc, rayDir);
            let c = dot(oc, oc) - 1.0;
            let h = b * b - c;

            if (h < 0.0) {
              return -1.0;
            }

            let sqrtH = sqrt(h);
            let t0 = -b - sqrtH;
            let t1 = -b + sqrtH;
            if (t0 > 0.0) {
              return t0;
            }
            if (t1 > 0.0) {
              return t1;
            }
            return -1.0;
          }

          fn ggxDistribution(nDotH : f32, alpha : f32) -> f32 {
            let a2 = alpha * alpha;
            let denom = nDotH * nDotH * (a2 - 1.0) + 1.0;
            return a2 / max(3.14159265 * denom * denom, 0.0001);
          }

          fn schlickGGX(nDotX : f32, roughness : f32) -> f32 {
            let r = roughness + 1.0;
            let k = (r * r) / 8.0;
            return nDotX / max(nDotX * (1.0 - k) + k, 0.0001);
          }

          fn smithGeometry(nDotL : f32, nDotV : f32, roughness : f32) -> f32 {
            return schlickGGX(nDotL, roughness) * schlickGGX(nDotV, roughness);
          }

          fn fresnelSchlick(cosTheta : f32, f0 : vec3<f32>) -> vec3<f32> {
            return f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - cosTheta, 5.0);
          }

          fn acesApprox(color : vec3<f32>) -> vec3<f32> {
            let a = 2.51;
            let b = 0.03;
            let c = 2.43;
            let d = 0.59;
            let e = 0.14;
            return clamp(
              (color * (a * color + b)) / (color * (c * color + d) + e),
              vec3<f32>(0.0),
              vec3<f32>(1.0)
            );
          }

          fn gammaEncode(color : vec3<f32>) -> vec3<f32> {
            let safeColor = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
            return vec3<f32>(
              pow(safeColor.x, 1.0 / 2.2),
              pow(safeColor.y, 1.0 / 2.2),
              pow(safeColor.z, 1.0 / 2.2)
            );
          }

          @fragment
          fn fsMain(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {
            let resolution = uniforms.resolutionModelExposure.xy;
            let modelMode = uniforms.resolutionModelExposure.z;
            let exposure = uniforms.resolutionModelExposure.w;
            let baseColor = uniforms.baseColorRoughness.xyz;
            let roughness = uniforms.baseColorRoughness.w;
            let metallic = uniforms.metallicSpecularF0Shininess.x;
            let specularLevel = uniforms.metallicSpecularF0Shininess.y;
            let fresnelF0 = uniforms.metallicSpecularF0Shininess.z;
            let shininess = uniforms.metallicSpecularF0Shininess.w;
            let lightDir = normalize(uniforms.lightDirIntensity.xyz);
            let lightIntensity = uniforms.lightDirIntensity.w;
            let specularColor = uniforms.specularColorOrbitYaw.xyz;
            let orbitYaw = uniforms.specularColorOrbitYaw.w;
            let orbitPitch = uniforms.orbitPitchPadding.x;

            let uv = fragCoord.xy / resolution * 2.0 - vec2<f32>(1.0, 1.0);
            let aspect = resolution.x / resolution.y;
            let tanHalfFov = tan(0.38);

            var cameraPos = vec3<f32>(0.0, 0.0, 3.2);
            cameraPos = rotateY(cameraPos, orbitYaw);
            cameraPos = rotateX(cameraPos, orbitPitch);

            let forward = normalize(-cameraPos);
            let right = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), forward));
            let up = cross(forward, right);
            let rayDir = normalize(
              forward +
              right * (uv.x * aspect * tanHalfFov) -
              up * (uv.y * tanHalfFov)
            );

            let t = intersectSphere(cameraPos, rayDir);
            if (t < 0.0) {
              let background = skyColor(rayDir) * vec3<f32>(0.92, 0.95, 1.0);
              let mapped = acesApprox(background * exposure);
              return vec4<f32>(gammaEncode(mapped), 1.0);
            }

            let hitPos = cameraPos + rayDir * t;
            let normal = normalize(hitPos);
            let viewDir = normalize(cameraPos - hitPos);
            let halfVec = normalize(lightDir + viewDir);
            let reflectView = reflect(-viewDir, normal);
            let nDotL = max(dot(normal, lightDir), 0.0);
            let nDotV = max(dot(normal, viewDir), 0.0);
            let nDotH = max(dot(normal, halfVec), 0.0);
            let vDotH = max(dot(viewDir, halfVec), 0.0);

            let ambientDiffuse = skyColor(normal) * (0.28 + 0.12 * normal.y);
            let ambientSpecDir = normalize(mix(reflectView, normal, roughness * roughness));
            let ambientSpec = environmentSpecular(ambientSpecDir, lightDir);
            let lightColor = vec3<f32>(1.0, 0.97, 0.93) * lightIntensity;

            var shaded = vec3<f32>(0.0);

            if (modelMode < 0.5) {
              let diffuse = baseColor / 3.14159265;
              shaded = diffuse * lightColor * nDotL + ambientDiffuse * baseColor;
            } else if (modelMode < 1.5) {
              let diffuse = baseColor / 3.14159265;
              let reflectionDir = reflect(-lightDir, normal);
              let phongSpec = pow(max(dot(reflectionDir, viewDir), 0.0), max(shininess, 1.0));
              let spec = specularColor * phongSpec;
              shaded = diffuse * lightColor * nDotL + spec * lightColor + ambientDiffuse * baseColor + ambientSpec * specularColor * 0.08;
            } else if (modelMode < 2.5) {
              let diffuse = baseColor / 3.14159265;
              let blinnSpec = pow(max(dot(normal, halfVec), 0.0), max(shininess, 1.0));
              let spec = specularColor * blinnSpec;
              shaded = diffuse * lightColor * nDotL + spec * lightColor + ambientDiffuse * baseColor + ambientSpec * specularColor * 0.1;
            } else {
              let alpha = max(roughness * roughness, 0.02);
              let f0 = mix(vec3<f32>(fresnelF0 * specularLevel), baseColor, metallic);
              let fresnel = fresnelSchlick(vDotH, f0);
              let distribution = ggxDistribution(nDotH, alpha);
              let geometry = smithGeometry(nDotL, nDotV, roughness);
              let specular = (distribution * geometry) * fresnel / max(4.0 * nDotL * nDotV, 0.0001);
              let kd = (vec3<f32>(1.0) - fresnel) * (1.0 - metallic);
              let diffuse = kd * baseColor / 3.14159265;
              let envFresnel = fresnelSchlick(max(dot(normal, viewDir), 0.0), f0);
              let ambient = ambientDiffuse * diffuse * 2.6 + ambientSpec * envFresnel * mix(1.0, 0.32, roughness);
              shaded = (diffuse + specular) * lightColor * nDotL + ambient;
            }

            let rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.08;
            let mapped = acesApprox((shaded + vec3<f32>(rim)) * exposure);
            return vec4<f32>(gammaEncode(mapped), 1.0);
          }
        `,
      });

      if (typeof shaderModule.getCompilationInfo === "function") {
        const compilationInfo = await shaderModule.getCompilationInfo();
        const shaderErrors = compilationInfo.messages.filter((message) => message.type === "error");
        if (shaderErrors.length > 0) {
          throw new Error(
            shaderErrors
              .slice(0, 4)
              .map((message) => `WGSL ${message.lineNum}:${message.linePos} ${message.message}`)
              .join("\n")
          );
        }
      }

      const pipelineDescriptor = {
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vsMain",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fsMain",
          targets: [{ format: this.format }],
        },
        primitive: {
          topology: "triangle-list",
        },
      };

      if (typeof this.device.createRenderPipelineAsync === "function") {
        this.pipeline = await this.device.createRenderPipelineAsync(pipelineDescriptor);
      } else {
        this.pipeline = this.device.createRenderPipeline(pipelineDescriptor);
      }

      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
      });

      this.device.lost.then((info) => {
        if (this.animationFrameId) {
          window.cancelAnimationFrame(this.animationFrameId);
        }
        fallback.hidden = false;
        gpuStatusBadge.textContent = "WebGPU Lost";
        gpuStatusBadge.classList.remove("is-live");
        console.error("WebGPU device lost", info);
      });

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.sizeTarget);
      this.resize();
      this.frame();
    }

    resize() {
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.sizeTarget.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      const height = Math.max(1, Math.floor(rect.height * devicePixelRatio));

      if (this.canvas.width === width && this.canvas.height === height && this.isConfigured) {
        return;
      }

      this.canvas.width = width;
      this.canvas.height = height;
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "opaque",
      });
      this.isConfigured = true;
    }

    setState(sceneState) {
      this.sceneState = sceneState;
    }

    updateUniformBuffer() {
      if (!this.sceneState) {
        return;
      }

      this.uniformData[0] = Math.max(this.canvas.width, 1);
      this.uniformData[1] = Math.max(this.canvas.height, 1);
      this.uniformData[2] = this.sceneState.modelMode;
      this.uniformData[3] = this.sceneState.exposure;

      this.uniformData[4] = this.sceneState.baseColor[0];
      this.uniformData[5] = this.sceneState.baseColor[1];
      this.uniformData[6] = this.sceneState.baseColor[2];
      this.uniformData[7] = this.sceneState.roughness;

      this.uniformData[8] = this.sceneState.metallic;
      this.uniformData[9] = this.sceneState.specularLevel;
      this.uniformData[10] = this.sceneState.fresnelF0;
      this.uniformData[11] = this.sceneState.shininess;

      this.uniformData[12] = this.sceneState.lightDirection[0];
      this.uniformData[13] = this.sceneState.lightDirection[1];
      this.uniformData[14] = this.sceneState.lightDirection[2];
      this.uniformData[15] = this.sceneState.lightIntensity;

      this.uniformData[16] = this.sceneState.specularColor[0];
      this.uniformData[17] = this.sceneState.specularColor[1];
      this.uniformData[18] = this.sceneState.specularColor[2];
      this.uniformData[19] = this.sceneState.orbitYaw;

      this.uniformData[20] = this.sceneState.orbitPitch;
      this.uniformData[21] = 0;
      this.uniformData[22] = 0;
      this.uniformData[23] = 0;

      this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
    }

    render() {
      if (!this.device || !this.pipeline) {
        return;
      }

      this.updateUniformBuffer();

      const encoder = this.device.createCommandEncoder();
      const view = this.context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: 0.04, g: 0.045, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(3, 1, 0, 0);
      pass.end();

      this.device.queue.submit([encoder.finish()]);
    }

    frame() {
      this.render();
      this.animationFrameId = window.requestAnimationFrame(() => this.frame());
    }
  }

  let renderer = null;

  function updateRendererState() {
    if (renderer) {
      renderer.setState(buildRenderState());
    }
  }

  function bindCanvasOrbit() {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }

      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;

      state.orbitYaw += deltaX * 0.01;
      state.orbitPitch = Math.max(-0.85, Math.min(0.85, state.orbitPitch + deltaY * 0.01));
      updateRendererState();
    });

    const stopDragging = (event) => {
      if (dragging && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      dragging = false;
    };

    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
  }

  async function initRenderer() {
    try {
      renderer = new WebGPUPBRRenderer(canvas, canvasShell);
      await renderer.init();
      fallback.hidden = true;
      gpuStatusBadge.textContent = "WebGPU Live";
      gpuStatusBadge.classList.add("is-live");
      updateRendererState();
    } catch (error) {
      fallback.hidden = false;
      gpuStatusBadge.textContent = "WebGPU Error";
      gpuStatusBadge.classList.remove("is-live");
      console.error(error);
    }
  }

  function syncUIAfterModelChange() {
    controlPanelTitle.textContent = `${getCurrentModel().selectLabel} 参数`;
    restoreDefaultHints();
    renderControls();
    renderDocs();
    updateRendererState();
  }

  function init() {
    applyModelSelection(state.modelId);
    resetCurrentModelParams();
    renderControls();
    renderDocs();
    setControlsVisibility(true);
    restoreDefaultHints();
    bindCanvasOrbit();

    modelSelect.addEventListener("change", (event) => {
      applyModelSelection(event.target.value);
      syncUIAfterModelChange();
    });

    resetParamsButton.addEventListener("click", () => {
      resetCurrentModelParams();
      syncUIAfterModelChange();
    });

    toggleControlsButton.addEventListener("click", () => {
      setControlsVisibility(!state.controlsVisible);
    });

    initRenderer();
  }

  init();
})();
