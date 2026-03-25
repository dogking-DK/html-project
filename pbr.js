(function () {
  const modelSelect = document.getElementById("modelSelect");
  const sceneControlsContainer = document.getElementById("sceneControls");
  const materialControlsContainer = document.getElementById("materialControls");
  const resetParamsButton = document.getElementById("resetParamsButton");
  const docContent = document.getElementById("pbrDocContent");
  const gpuStatusBadge = document.getElementById("gpuStatusBadge");
  const environmentStatusBadge = document.getElementById("environmentStatusBadge");
  const environmentStatusInline = document.getElementById("environmentStatusInline");
  const environmentStatusText = document.getElementById("environmentStatusText");
  const loadHdrFileButton = document.getElementById("loadHdrFileButton");
  const hdrFileInput = document.getElementById("hdrFileInput");
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
    !environmentStatusBadge ||
    !environmentStatusInline ||
    !environmentStatusText ||
    !loadHdrFileButton ||
    !hdrFileInput ||
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
  const SCENE_KEYS = ["envSource", "lightIntensity", "lightAzimuth", "lightElevation", "exposure"];
  const CONTROL_JUMP_HIGHLIGHT_MS = 1800;
  const DEFAULT_STAGE_HINT =
    "拖拽球体旋转视角；左上角可显示或隐藏参数面板；场景参数里可以切换程序天空与 HDR 环境贴图。";
  const HDR_ENVIRONMENT = {
    label: "HDR 环境贴图",
    url: "assets/texture/citrus_orchard_road_puresky_4k.hdr",
  };

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
    envSource: {
      type: "select",
      label: "Environment",
      default: "hdr",
      options: [
        { value: "hdr", label: "HDR 环境贴图" },
        { value: "procedural", label: "程序天空" },
      ],
      hint: "切换背景与环境采样来源；HDR 只会参与背景、反射和折射采样，材质本身的颜色与参数仍由当前模型控制。",
    },
    ior: {
      type: "range",
      label: "IOR",
      min: 1,
      max: 2.5,
      step: 0.01,
      default: 1.52,
      hint: "折射率决定光在两种介质交界面的弯折程度。",
    },
    transmission: {
      type: "range",
      label: "Transmission",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.95,
      hint: "控制有多少能量走透射通道，而不是停留在表面反射。",
    },
    absorption: {
      type: "range",
      label: "Absorption",
      min: 0.05,
      max: 4,
      step: 0.01,
      default: 0.8,
      hint: "Beer-Lambert 吸收强度，决定透射路径中颜色衰减的速度。",
    },
    subsurface: {
      type: "range",
      label: "Subsurface",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.65,
      hint: "控制表面以下散射的参与强度，越大越有蜡感或皮肤感。",
    },
    scatterDistance: {
      type: "range",
      label: "Scatter Distance",
      min: 0.1,
      max: 3,
      step: 0.01,
      default: 1.2,
      hint: "决定散射在材质内部传播多远，越大越柔和通透。",
    },
    density: {
      type: "range",
      label: "Density",
      min: 0.05,
      max: 3,
      step: 0.01,
      default: 0.65,
      hint: "介质消光系数的简化控制项，决定体积雾球的浓度与透视深度。",
    },
    anisotropy: {
      type: "range",
      label: "Anisotropy",
      min: -0.85,
      max: 0.85,
      step: 0.01,
      default: 0.3,
      hint: "Henyey-Greenstein 相函数参数 g，控制前向或后向散射倾向。",
    },
  };

  const COMMON_PARAMETER_NOTES = {
    envSource: {
      key: "envSource",
      title: "Environment",
      meaning: "控制背景与环境照明的来源，是背景显示与间接环境采样的统一开关。",
      visual: "切到 HDR 后，背景会显示环境贴图，镜面反射和折射也会带上同一张图的结构与高亮，但材质底色仍由当前模型参数决定。",
      coupling: "它与 roughness、transmission、metallic 等参数一起影响环境信息的清晰度，但不会直接改写材质本身的颜色参数。",
    },
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

  const MODEL_CLASS_INFO = {
    surface: {
      label: "表面反射模型",
      description: "主要描述不透明表面的漫反射、高光反射，典型就是各种 BRDF。",
    },
    transmission: {
      label: "透射 / 折射模型",
      description: "描述玻璃、水、透明塑料这类材料，典型形式是 BTDF / BSDF。",
    },
    subsurface: {
      label: "次表面散射模型",
      description:
        "描述皮肤、蜡、牛奶、大理石这类“光会进到表面下面再出来”的材料，典型形式是 BSSRDF。",
    },
    volume: {
      label: "体积散射模型",
      description: "描述烟雾、云、雾与参与介质，典型形式是 phase function 加 volume rendering。",
    },
  };

  const MODELS = [
    {
      id: "lambert",
      selectLabel: "Lambert",
      name: "Lambert Diffuse Model",
      subtitle: "理想漫反射基线模型",
      family: "Surface Reflection / Diffuse BRDF",
      transportKind: "surface",
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
      renderProxy: "左侧直接渲染 Lambert 漫反射球体，用它来建立最基础的明暗与余弦项直觉。",
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
      transportKind: "surface",
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
      renderProxy: "左侧使用反射向量驱动的经验高光球体，方便直接看到 shininess 如何压缩高光峰。",
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
      transportKind: "surface",
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
      renderProxy: "左侧把高光改写为半角向量驱动，便于和微表面模型做视觉对照。",
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
      transportKind: "surface",
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
      renderProxy:
        "左侧使用方向光加环境反射近似来展示 GGX 的 roughness、metallic 和 Fresnel 之间的核心感知关系。",
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
    {
      id: "glass-bsdf",
      selectLabel: "Glass BSDF",
      name: "Dielectric Transmission / Refraction BSDF",
      subtitle: "用于玻璃、水、透明塑料的介电体透射模型",
      family: "Transmission / Refraction / BSDF",
      transportKind: "transmission",
      shaderMode: 4,
      controls: ["baseColor", "roughness", "ior", "transmission", "absorption"],
      defaults: {
        baseColor: "#D9F5FF",
        roughness: 0.08,
        ior: 1.52,
        transmission: 0.96,
        absorption: 0.9,
        lightIntensity: 4.1,
        lightAzimuth: 34,
        lightElevation: 46,
        exposure: 1.04,
      },
      oneLiner: "通过 Fresnel、Snell 折射与 Beer-Lambert 吸收共同描述介电体的反射、透射和路径着色。",
      coreIdea:
        "透明材料并不是“没有反射”，而是会把一部分能量留在表面镜面反射上，另一部分按照折射率进入介质内部继续传播。传播路径越长，吸收越明显，颜色也会逐渐染上介质 tint。",
      scopeNote:
        "严格的微表面 BTDF 会同时考虑法线分布、遮蔽和雅可比项。这里的左侧渲染保留了折射率、Fresnel 与吸收的关键趋势，但用的是更轻量的教学近似。",
      renderProxy:
        "左侧使用单次入射折射、出射折射、表面 Fresnel 与 Beer-Lambert 路径吸收近似，重点帮助理解玻璃类材质为什么会同时有反射边缘和着色透射。",
      stageHint: "Glass BSDF 把表面反射与介质内透射同时表现出来，适合观察 IOR 和吸收对外观的联动影响。",
      formulas: [
        {
          title: "Snell's Law",
          tex: "\\eta_i \\sin\\theta_i = \\eta_t \\sin\\theta_t",
          explanation: "折射率决定入射光进入介质后弯折多少，是玻璃/水这类材质最基础的几何规律。",
        },
        {
          title: "Fresnel Base Reflectance",
          tex: "F_0 = \\left(\\frac{\\eta_t - \\eta_i}{\\eta_t + \\eta_i}\\right)^2,\\qquad F(\\theta) \\approx F_0 + (1-F_0)(1-\\cos\\theta)^5",
          explanation: "即使是透明介质，掠射角的表面反射仍然会明显增强。",
        },
        {
          title: "Beer-Lambert Attenuation",
          tex: "T(d) = \\exp(-\\sigma_a d)",
          explanation: "光在介质内传播得越远，吸收越强，因此厚边缘通常更显色。",
        },
      ],
      formulaTerms: [
        {
          key: "ior",
          symbol: "\\eta",
          meaning: "折射率，决定反射底值与折射角变化。",
        },
        {
          key: "transmission",
          symbol: "1-F",
          meaning: "透射通道权重，表示有多少能量进入介质内部传播。",
        },
        {
          key: "absorption",
          symbol: "\\sigma_a",
          meaning: "介质吸收系数，决定透射路径中的颜色衰减速度。",
        },
      ],
      intuition:
        "玻璃看起来“亮”并不是因为它本身发光，而是因为它在边缘会更强烈地反射环境，同时把另一部分光弯折后带着路径吸收穿过物体。IOR 让折射更弯，absorption 让厚的地方更有颜色。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Tint",
          meaning: "在透射模型里更接近介质 tint，而不是不透明漫反射底色。",
          visual: "颜色越偏向某个通道，透过球体后的环境色也越容易被染上该颜色。",
          coupling: "通常和 absorption 一起工作；只有 tint 没有吸收时，玻璃会显得不够厚重。",
        },
        {
          key: "roughness",
          title: "Roughness",
          meaning: "控制表面微粗糙度，从而影响反射和折射的清晰程度。",
          visual: "增大后表面反射更散，折射环境也会变得模糊，更接近磨砂玻璃。",
          coupling: "会同时影响表面镜面层和透射图像的锐利程度。",
        },
        {
          key: "ior",
          title: "IOR",
          meaning: "介质折射率，决定 Fresnel 底值和折射弯折量。",
          visual: "增大后边缘反射更明显，背景也会出现更强的几何扭曲感。",
          coupling: "与 transmission、roughness 一起决定“看见表面”还是“看穿物体”的平衡。",
        },
        {
          key: "transmission",
          title: "Transmission",
          meaning: "透射能量比例，决定多少光线进入介质而不是停留在表面。",
          visual: "增大后球体更通透，减小时更像清漆或带镜面层的实心材料。",
          coupling: "与 IOR、absorption 一起决定最终像玻璃、水还是透明塑料。",
        },
        {
          key: "absorption",
          title: "Absorption",
          meaning: "路径吸收强度，用来模拟介质内部的能量损失。",
          visual: "增大后边缘和厚区域会更快染色并变暗，材料厚重感更强。",
          coupling: "和 baseColor 强耦合；颜色 tint 主要通过吸收路径显现出来。",
        },
      ],
      pros: [
        "能直观展示透明介质为什么同时有表面反射和内部透射。",
        "IOR、Fresnel 与吸收的关系非常适合教学演示。",
        "是从 BRDF 扩展到完整 BSDF 语义的关键一步。",
      ],
      cons: [
        "严格 BTDF 的多重散射和复杂微表面效应并没有全部展开。",
        "真实玻璃还会涉及色散、焦散和多次内部反射等更复杂现象。",
      ],
      useCases: [
        "玻璃、水、透明塑料和清漆类材料教学",
        "解释 BRDF 与 BSDF 的差别",
        "建立 IOR / Fresnel / 吸收三者之间的直觉",
      ],
    },
    {
      id: "subsurface-scattering",
      selectLabel: "Subsurface Scattering",
      name: "Subsurface Scattering Approximation",
      subtitle: "面向皮肤、蜡、牛奶等材料的 BSSRDF 教学近似",
      family: "Subsurface Scattering / BSSRDF",
      transportKind: "subsurface",
      shaderMode: 5,
      controls: ["baseColor", "roughness", "subsurface", "scatterDistance"],
      defaults: {
        baseColor: "#F0A087",
        roughness: 0.5,
        subsurface: 0.86,
        scatterDistance: 1.7,
        lightIntensity: 4.9,
        lightAzimuth: -152,
        lightElevation: 24,
        exposure: 1.04,
      },
      oneLiner: "用“光先进入表面，再在材质内部扩散后重新出射”的观点来描述皮肤、蜡和大理石这类柔和半透明材料。",
      coreIdea:
        "BSSRDF 与 BRDF 的关键区别在于：入射点和出射点不一定是同一个点。光可以在表面下方传播一段距离，再从附近位置离开表面，因此会出现柔和、厚感和轻微透光的效果。",
      scopeNote:
        "完整 BSSRDF 需要在表面邻域上做空间积分。当前左侧渲染用“厚度估计 + wrap diffuse + 内部衰减”来给出教学可视化，而不是严格扩散解。",
      renderProxy:
        "左侧球体默认采用更明显的背侧打光，并用厚度驱动的内部散射近似来强化边缘透光、蜡质柔和阴影和皮肤感高光之间的对比，用来帮助理解“光进入表面下面再出来”这件事。",
      stageHint: "SSS 会让明暗过渡变软、边缘更有透光感，是 BRDF 无法单独解释的材质现象。",
      formulas: [
        {
          title: "BSSRDF Definition",
          tex: "L_o(x_o,\\omega_o) = \\int_A \\int_{\\Omega^+} S(x_i,\\omega_i; x_o,\\omega_o)\\,L_i(x_i,\\omega_i)\\,(n_i\\cdot\\omega_i)\\,d\\omega_i\\,dA(x_i)",
          explanation: "BSSRDF 明确允许入射点与出射点不同，这是次表面散射区别于普通 BRDF 的核心。",
        },
        {
          title: "Diffusion-style Falloff",
          tex: "R_d(r) \\approx A\\,\\frac{e^{-\\sigma_{tr} r}}{r}",
          explanation: "扩散近似把散射理解为在表面下逐渐衰减的空间传播过程。",
        },
        {
          title: "Teaching Proxy",
          tex: "L_{proxy} \\approx L_{wrap\\,diffuse} + k_{sss}\\,T_{thickness}",
          explanation: "这里的教学实现用包裹漫反射与厚度衰减近似内部散射，不追求严格离线渲染精度。",
        },
      ],
      formulaTerms: [
        {
          key: "subsurface",
          symbol: "k_{sss}",
          meaning: "内部散射强度，决定表面下传播对最终亮度的贡献。",
        },
        {
          key: "scatterDistance",
          symbol: "\\sigma_{tr}^{-1}",
          meaning: "等效散射距离，决定内部传播能走多远才明显衰减。",
        },
        {
          key: "baseColor",
          symbol: "A",
          meaning: "散射 tint 或扩散反照率，决定皮肤/蜡/牛奶的底色。",
        },
      ],
      intuition:
        "皮肤看起来柔和，是因为光不是只在最外层“弹一下就走”，而是会钻进表面下方绕一圈再出来。于是暗部边缘会发亮、阴影会被冲淡，整个物体像有一层发散开的内部光。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Scattering Tint",
          meaning: "在 SSS 模型里更接近体内散射 tint，而不只是表面漫反射色。",
          visual: "它会主导半透亮边、次表面发光区域和整体肤色/蜡色基调。",
          coupling: "与 subsurface、scatterDistance 一起决定“暖透感”是否成立。",
        },
        {
          key: "roughness",
          title: "Roughness",
          meaning: "控制表面镜面层的清晰程度，用来区分油润皮肤和哑光蜡面。",
          visual: "增大后高光更宽更柔，不会盖过内部散射的效果。",
          coupling: "常与 subsurface 配合，避免表面镜面过强把 SSS 感掩盖掉。",
        },
        {
          key: "subsurface",
          title: "Subsurface",
          meaning: "内部散射通道的整体强度。",
          visual: "增大后暗部更被“抬起来”，边缘透光更明显，材质更像皮肤或蜡。",
          coupling: "与 scatterDistance 一起控制是“浅层柔化”还是“深层通透”。",
        },
        {
          key: "scatterDistance",
          title: "Scatter Distance",
          meaning: "等效平均自由程，决定内部传播尺度。",
          visual: "增大后亮边更柔和、更宽，厚区域也不容易立刻变暗。",
          coupling: "与 baseColor 耦合后会决定暖色或冷色透散的空间范围。",
        },
      ],
      pros: [
        "能解释皮肤、蜡、牛奶和大理石为什么看起来柔和而非纯表面反射。",
        "把 BRDF 无法表达的空间传播概念引入教学界面。",
        "对比同样 roughness 下的普通 BRDF，视觉差异非常直观。",
      ],
      cons: [
        "严格 BSSRDF 需要空间积分、层状结构和更完整的多重散射模型。",
        "当前左侧实现是教学近似，不适合作为影视级材质求解器。",
      ],
      useCases: [
        "皮肤、蜡、牛奶、大理石等材料教学",
        "讲解 BRDF 与 BSSRDF 的根本差别",
        "理解厚度、散射距离与柔和阴影之间的联系",
      ],
    },
    {
      id: "homogeneous-volume",
      selectLabel: "Homogeneous Volume",
      name: "Homogeneous Volume with Henyey-Greenstein Phase",
      subtitle: "用于烟雾、云、雾和参与介质的单次散射教学模型",
      family: "Participating Media / Phase Function / Volume Rendering",
      transportKind: "volume",
      shaderMode: 6,
      controls: ["baseColor", "density", "anisotropy"],
      defaults: {
        baseColor: "#D8E6FF",
        density: 0.72,
        anisotropy: 0.36,
        lightIntensity: 4.5,
        lightAzimuth: 24,
        lightElevation: 48,
        exposure: 1.01,
      },
      oneLiner: "把光在介质中沿路径不断被吸收、散射和重新分配的过程写成体积积分，是烟雾和云雾类外观的核心。",
      coreIdea:
        "体积渲染不再只关心表面法线，而是关心光在空间中的每一点如何被散射。相函数决定光更偏向前向还是后向散射，密度则决定这段路径到底有多浑浊、多不透明。",
      scopeNote:
        "当前左侧实现是均匀球形介质的单次散射近似，会对球体内部做短程 ray marching，用来突出相函数、密度和透视深度的关系。",
      renderProxy:
        "左侧用球形参与介质容器来演示 volume rendering：背景会被体积吸收，内部会沿光线路径逐步积累散射亮度，从而形成雾球、云核或烟团感。",
      stageHint: "体积散射不依赖表面高光，而依赖路径积分、密度和相函数；它更像“看穿一团介质”而不是“看一个壳”。",
      formulas: [
        {
          title: "Volume Rendering Equation",
          tex: "L_o = T(0,d)\\,L_{bg} + \\int_0^d T(0,s)\\,\\sigma_s\\,p(\\omega_i,\\omega_o)\\,L_i(s)\\,ds",
          explanation: "相机看到的是“背景穿透后的剩余能量”和“沿途不断累积的体积散射”之和。",
        },
        {
          title: "Henyey-Greenstein Phase",
          tex: "p_{HG}(\\cos\\theta) = \\frac{1-g^2}{4\\pi\\left(1+g^2-2g\\cos\\theta\\right)^{3/2}}",
          explanation: "参数 g 决定散射是否偏向前向、后向或近似各向同性。",
        },
        {
          title: "Transmittance",
          tex: "T(0,s) = \\exp(-\\sigma_t s)",
          explanation: "密度越大，穿过相同路径长度后剩下的透射能量越少。",
        },
      ],
      formulaTerms: [
        {
          key: "density",
          symbol: "\\sigma_t",
          meaning: "消光系数，决定体积吸收与散射导致的整体衰减速度。",
        },
        {
          key: "anisotropy",
          symbol: "g",
          meaning: "相函数各向异性参数，决定前向/后向散射倾向。",
        },
        {
          key: "baseColor",
          symbol: "\\sigma_s\\,/\\,albedo",
          meaning: "体积散射 tint，决定云雾或烟团被照亮时的颜色取向。",
        },
      ],
      intuition:
        "当你看一团雾时，真正发生的不是“表面有个高光”，而是视线一路穿过介质时，不断有光被吸收掉，同时又不断有来自光源方向的散射补回来。density 决定有多厚，anisotropy 决定亮雾更偏向迎光还是背光。",
      parameterNotes: [
        {
          key: "baseColor",
          title: "Base Color / Scattering Tint",
          meaning: "体积散射的颜色倾向，控制被照亮后的雾、烟或云是什么色相。",
          visual: "它会影响整个体积内部的亮部颜色，而不是一个表面贴图式的底色。",
          coupling: "与 density 一起决定是“轻薄带色雾”还是“厚重有色烟”。",
        },
        {
          key: "density",
          title: "Density",
          meaning: "介质浓度，等效地控制消光系数大小。",
          visual: "增大后更不透明、背景更快被吃掉，同时光柱和亮核更集中。",
          coupling: "与 anisotropy、lightIntensity 共同决定体积的“亮核”和“透视感”。",
        },
        {
          key: "anisotropy",
          title: "Anisotropy",
          meaning: "相函数参数 g，描述散射偏向前向还是后向。",
          visual: "正值增大时更容易在与光线接近的方向看到亮核；负值则更偏后向反射。",
          coupling: "它不直接改变总体密度，但会改变亮区在体积中的空间分布。",
        },
      ],
      pros: [
        "把教学视角从“表面法线”扩展到“沿路径积分”的体积观念。",
        "适合讲解烟雾、云层、薄雾等参与介质为什么会发亮或遮挡背景。",
        "HG 相函数参数 g 的视觉影响非常容易直接观察。",
      ],
      cons: [
        "这里只实现了均匀介质和单次散射，真实云雾通常需要多重散射与噪声密度场。",
        "与表面着色相比，体积渲染对采样和性能更敏感。",
      ],
      useCases: [
        "烟雾、云、雾、参与介质教学演示",
        "解释相函数、密度与路径积分",
        "从表面着色过渡到体积渲染的入门演示",
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
  let controlJumpTimeoutId = 0;

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
    if (def.type === "select") {
      return def.options.find((option) => option.value === value)?.label ?? String(value);
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

  const float32View = new Float32Array(1);
  const uint32View = new Uint32Array(float32View.buffer);

  function floatToHalf(value) {
    float32View[0] = value;
    const bits = uint32View[0];
    const sign = (bits >> 16) & 0x8000;
    const mantissa = bits & 0x007fffff;
    const exponent = (bits >> 23) & 0xff;

    if (exponent === 0xff) {
      return sign | (mantissa ? 0x7e00 : 0x7c00);
    }

    if (exponent < 103) {
      return sign;
    }

    if (exponent > 142) {
      return sign | 0x7c00;
    }

    if (exponent < 113) {
      const shiftedMantissa = (mantissa | 0x00800000) >> (114 - exponent);
      return sign | ((shiftedMantissa + 0x00001000) >> 13);
    }

    const halfExponent = exponent - 112;
    const halfMantissa = (mantissa + 0x00001000) >> 13;
    return sign | (halfExponent << 10) | (halfMantissa & 0x03ff);
  }

  function parseRadianceHdr(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let offset = 0;

    function readLine() {
      if (offset >= bytes.length) {
        return null;
      }

      let line = "";
      while (offset < bytes.length) {
        const value = bytes[offset++];
        if (value === 0x0a) {
          break;
        }
        if (value !== 0x0d) {
          line += String.fromCharCode(value);
        }
      }
      return line;
    }

    const magic = readLine();
    if (!magic || !magic.startsWith("#?")) {
      throw new Error("Invalid HDR header");
    }

    let formatLineFound = false;
    while (true) {
      const line = readLine();
      if (line === null) {
        throw new Error("HDR header ended unexpectedly");
      }
      if (line.length === 0) {
        break;
      }
      if (line === "FORMAT=32-bit_rle_rgbe") {
        formatLineFound = true;
      }
    }

    if (!formatLineFound) {
      throw new Error("Unsupported HDR format");
    }

    const resolutionLine = readLine();
    const resolutionMatch = resolutionLine?.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/);
    if (!resolutionMatch) {
      throw new Error("Invalid HDR resolution line");
    }

    const height = Number(resolutionMatch[1]);
    const width = Number(resolutionMatch[2]);
    const scanline = new Uint8Array(width * 4);
    const data = new Float32Array(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      const b0 = bytes[offset++];
      const b1 = bytes[offset++];
      const b2 = bytes[offset++];
      const b3 = bytes[offset++];

      if (b0 !== 2 || b1 !== 2 || (b2 & 0x80) !== 0 || ((b2 << 8) | b3) !== width) {
        throw new Error("Unsupported HDR scanline encoding");
      }

      for (let channel = 0; channel < 4; channel += 1) {
        let x = 0;
        while (x < width) {
          const count = bytes[offset++];
          if (count > 128) {
            const runLength = count - 128;
            const value = bytes[offset++];
            scanline.fill(value, channel * width + x, channel * width + x + runLength);
            x += runLength;
          } else {
            const runLength = count;
            for (let i = 0; i < runLength; i += 1) {
              scanline[channel * width + x] = bytes[offset++];
              x += 1;
            }
          }
        }
      }

      for (let x = 0; x < width; x += 1) {
        const r = scanline[x];
        const g = scanline[width + x];
        const b = scanline[width * 2 + x];
        const e = scanline[width * 3 + x];
        const pixelIndex = (y * width + x) * 4;

        if (e > 0) {
          const scale = Math.pow(2, e - 136);
          data[pixelIndex] = r * scale;
          data[pixelIndex + 1] = g * scale;
          data[pixelIndex + 2] = b * scale;
          data[pixelIndex + 3] = 1;
        } else {
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
          data[pixelIndex + 3] = 1;
        }
      }
    }

    return { width, height, data };
  }

  function packHdrTextureData(width, height, data) {
    const sourceBytesPerRow = width * 8;
    const bytesPerRow = Math.ceil(sourceBytesPerRow / 256) * 256;
    const target = new Uint16Array((bytesPerRow / 2) * height);

    for (let y = 0; y < height; y += 1) {
      const srcRowOffset = y * width * 4;
      const dstRowOffset = (bytesPerRow / 2) * y;
      for (let x = 0; x < width; x += 1) {
        const srcIndex = srcRowOffset + x * 4;
        const dstIndex = dstRowOffset + x * 4;
        target[dstIndex] = floatToHalf(data[srcIndex]);
        target[dstIndex + 1] = floatToHalf(data[srcIndex + 1]);
        target[dstIndex + 2] = floatToHalf(data[srcIndex + 2]);
        target[dstIndex + 3] = floatToHalf(data[srcIndex + 3]);
      }
    }

    return { bytesPerRow, data: target };
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

    if (def.type === "select") {
      return `
        <label class="control-row" data-param-key="${key}">
          <div class="control-row-top">
            <div class="control-row-title">
              <span>${def.label}</span>
            </div>
            <span class="control-row-value" data-control-value-key="${key}">${formattedValue}</span>
          </div>
          <select class="control-select" data-param-input="${key}" aria-label="${def.label}">
            ${def.options
              .map(
                (option) =>
                  `<option value="${option.value}" ${option.value === value ? "selected" : ""}>${option.label}</option>`
              )
              .join("")}
          </select>
        </label>
      `;
    }

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
    const groupedModels = Object.keys(MODEL_CLASS_INFO).map((groupKey) => ({
      key: groupKey,
      label: MODEL_CLASS_INFO[groupKey].label,
      entries: MODELS.filter((entry) => entry.transportKind === groupKey),
    }));

    modelSelect.innerHTML = groupedModels
      .map(
        (group) => `
          <optgroup label="${group.label}">
            ${group.entries
              .map(
                (entry) =>
                  `<option value="${entry.id}" ${entry.id === model.id ? "selected" : ""}>${entry.selectLabel}</option>`
              )
              .join("")}
          </optgroup>
        `
      )
      .join("");

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
    const classInfo = MODEL_CLASS_INFO[model.transportKind];

    docContent.innerHTML = `
      <article class="pbr-model-hero">
        <div class="pbr-model-hero-copy">
          <p class="section-tag">Current Model</p>
          <h3>${model.name}</h3>
          <p class="pbr-model-subtitle">${model.subtitle}</p>
          <p>${model.oneLiner}</p>
        </div>
        <div class="pbr-model-badges" aria-label="模型标签">
          <span class="pbr-model-badge">${classInfo.label}</span>
          <span class="pbr-model-badge">${model.family}</span>
          <span class="pbr-model-badge">Shader Mode ${model.shaderMode}</span>
          <span class="pbr-model-badge">Implemented</span>
        </div>
      </article>

      <section class="pbr-doc-section">
        <h3>所属模型类别</h3>
        <div class="pbr-callout">
          <p>${classInfo.description}</p>
        </div>
        <p class="pbr-scope-note">${model.renderProxy}</p>
      </section>

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
                  <div class="pbr-formula-card-side">
                    <p class="formula-title">${formula.title}</p>
                  </div>
                  <div class="pbr-formula-card-main">
                    <div class="math-display">\\[ ${formula.tex} \\]</div>
                    <p class="math-note">${formula.explanation}</p>
                  </div>
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

  function clearControlJumpTarget() {
    controlPanel.querySelectorAll(".is-jump-target").forEach((element) => {
      element.classList.remove("is-jump-target");
    });
  }

  function jumpToControlParam(key) {
    if (!PARAM_DEFS[key]) {
      return;
    }

    if (!state.controlsVisible) {
      setControlsVisibility(true);
    }

    const targetRow = controlPanel.querySelector(`.control-row[data-param-key="${key}"]`);
    if (!targetRow) {
      return;
    }

    clearControlJumpTarget();
    setHighlightedParam(key);
    targetRow.classList.add("is-jump-target");

    if (controlJumpTimeoutId) {
      window.clearTimeout(controlJumpTimeoutId);
    }

    const panelCanScroll = controlPanel.scrollHeight > controlPanel.clientHeight + 4;
    if (panelCanScroll) {
      const panelRect = controlPanel.getBoundingClientRect();
      const targetRect = targetRow.getBoundingClientRect();
      const nextTop =
        controlPanel.scrollTop +
        (targetRect.top - panelRect.top) -
        Math.max(24, controlPanel.clientHeight * 0.28);
      controlPanel.scrollTo({
        top: Math.max(0, nextTop),
        behavior: "smooth",
      });
    } else {
      targetRow.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }

    const input = targetRow.querySelector("[data-param-input]");
    if (input && typeof input.focus === "function") {
      window.setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
      }, 220);
    }

    controlJumpTimeoutId = window.setTimeout(() => {
      clearControlJumpTarget();
      restoreDefaultHints();
    }, CONTROL_JUMP_HIGHLIGHT_MS);
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
        if (def.type === "color") {
          state.params[key] = input.value.toUpperCase();
        } else if (def.type === "select") {
          state.params[key] = input.value;
        } else {
          state.params[key] = Number(input.value);
        }
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
      element.addEventListener("click", () => {
        jumpToControlParam(key);
      });
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          jumpToControlParam(key);
        }
      });
    });
  }

  function buildRenderState() {
    return {
      modelMode: getCurrentModel().shaderMode,
      exposure: Number(state.params.exposure),
    environmentSource: state.params.envSource,
      baseColor: hexToLinearRgb(state.params.baseColor),
      roughness: Number(state.params.roughness ?? PARAM_DEFS.roughness.default),
      metallic: Number(state.params.metallic ?? PARAM_DEFS.metallic.default),
      specularLevel: Number(state.params.specularLevel ?? PARAM_DEFS.specularLevel.default),
      fresnelF0: Number(state.params.fresnelF0 ?? PARAM_DEFS.fresnelF0.default),
      shininess: Number(state.params.shininess ?? PARAM_DEFS.shininess.default),
      lightDirection: lightDirectionFromAngles(state.params.lightAzimuth, state.params.lightElevation),
      lightIntensity: Number(state.params.lightIntensity),
      specularColor: hexToLinearRgb(state.params.specularColor ?? PARAM_DEFS.specularColor.default),
      ior: Number(state.params.ior ?? PARAM_DEFS.ior.default),
      transmission: Number(state.params.transmission ?? PARAM_DEFS.transmission.default),
      absorption: Number(state.params.absorption ?? PARAM_DEFS.absorption.default),
      subsurface: Number(state.params.subsurface ?? PARAM_DEFS.subsurface.default),
      scatterDistance: Number(state.params.scatterDistance ?? PARAM_DEFS.scatterDistance.default),
      density: Number(state.params.density ?? PARAM_DEFS.density.default),
      anisotropy: Number(state.params.anisotropy ?? PARAM_DEFS.anisotropy.default),
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
      this.uniformData = new Float32Array(32);
      this.environmentTexture = null;
      this.environmentView = null;
      this.environmentSampler = null;
      this.environmentReady = false;
      this.lastEnvironmentError = null;
      this.sceneState = null;
      this.resizeObserver = null;
      this.animationFrameId = 0;
    }

    rebuildBindGroup() {
      if (!this.pipeline || !this.uniformBuffer || !this.environmentSampler || !this.environmentView) {
        return;
      }

      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: this.environmentSampler },
          { binding: 2, resource: this.environmentView },
        ],
      });
    }

    createDefaultEnvironmentResources() {
      const defaultPixels = new Uint16Array([
        floatToHalf(0.85),
        floatToHalf(0.9),
        floatToHalf(0.98),
        floatToHalf(1),
      ]);

      this.environmentTexture = this.device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        format: "rgba16float",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      this.device.queue.writeTexture(
        { texture: this.environmentTexture },
        defaultPixels,
        { bytesPerRow: 8, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );

      this.environmentView = this.environmentTexture.createView();
      this.environmentSampler = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "clamp-to-edge",
      });
    }

    applyEnvironmentTexture(texture, ready) {
      this.environmentTexture = texture;
      this.environmentView = texture.createView();
      this.environmentReady = ready;
      this.rebuildBindGroup();
    }

    async loadHdrEnvironmentFromArrayBuffer(buffer) {
      const hdr = parseRadianceHdr(buffer);
      const packed = packHdrTextureData(hdr.width, hdr.height, hdr.data);
      const texture = this.device.createTexture({
        size: { width: hdr.width, height: hdr.height, depthOrArrayLayers: 1 },
        format: "rgba16float",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      this.device.queue.writeTexture(
        { texture },
        packed.data,
        { bytesPerRow: packed.bytesPerRow, rowsPerImage: hdr.height },
        { width: hdr.width, height: hdr.height, depthOrArrayLayers: 1 }
      );

      this.applyEnvironmentTexture(texture, true);
      this.lastEnvironmentError = null;
    }

    async loadHdrEnvironment(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load HDR environment: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      await this.loadHdrEnvironmentFromArrayBuffer(buffer);
    }

    async loadHdrEnvironmentFromFile(file) {
      const buffer = await file.arrayBuffer();
      await this.loadHdrEnvironmentFromArrayBuffer(buffer);
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
      this.createDefaultEnvironmentResources();

      try {
        await this.loadHdrEnvironment(HDR_ENVIRONMENT.url);
      } catch (error) {
        this.environmentReady = false;
        this.lastEnvironmentError = error;
        console.warn(`HDR environment unavailable (${HDR_ENVIRONMENT.url})`, error);
      }

      const shaderModule = this.device.createShaderModule({
        code: `
          struct Uniforms {
            resolutionModelExposure : vec4<f32>,
            baseColorRoughness : vec4<f32>,
            metallicSpecularF0Shininess : vec4<f32>,
            lightDirIntensity : vec4<f32>,
            specularColorOrbitYaw : vec4<f32>,
            orbitPitchIorTransmissionSubsurface : vec4<f32>,
            absorptionScatterDensityAnisotropy : vec4<f32>,
            paddingData : vec4<f32>,
          };

          @group(0) @binding(0) var<uniform> uniforms : Uniforms;
          @group(0) @binding(1) var environmentSampler : sampler;
          @group(0) @binding(2) var environmentTexture : texture_2d<f32>;

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

          fn directionToEnvironmentUv(direction : vec3<f32>) -> vec2<f32> {
            let dir = normalize(direction);
            let u = fract(atan2(dir.x, -dir.z) / 6.2831853 + 0.5);
            let v = acos(clamp(dir.y, -1.0, 1.0)) / 3.14159265;
            return vec2<f32>(u, clamp(v, 0.0, 1.0));
          }

          fn sampleHdrEnvironment(direction : vec3<f32>) -> vec3<f32> {
            let uv = directionToEnvironmentUv(direction);
            return textureSampleLevel(environmentTexture, environmentSampler, uv, 0.0).rgb;
          }

          fn sampleEnvironment(direction : vec3<f32>, envMix : f32, lightDir : vec3<f32>) -> vec3<f32> {
            if (envMix > 0.5) {
              return sampleHdrEnvironment(direction);
            }
            return environmentSpecular(direction, lightDir);
          }

          fn tangentFromDirection(direction : vec3<f32>) -> vec3<f32> {
            if (abs(direction.y) > 0.92) {
              return normalize(cross(vec3<f32>(1.0, 0.0, 0.0), direction));
            }
            return normalize(cross(vec3<f32>(0.0, 1.0, 0.0), direction));
          }

          fn sampleEnvironmentBlurred(
            direction : vec3<f32>,
            blurAmount : f32,
            envMix : f32,
            lightDir : vec3<f32>
          ) -> vec3<f32> {
            let dir = normalize(direction);
            let blur = clamp(blurAmount, 0.0, 1.0);

            if (blur < 0.02) {
              return sampleEnvironment(dir, envMix, lightDir);
            }

            let tangent = tangentFromDirection(dir);
            let bitangent = normalize(cross(dir, tangent));
            let nearRadius = mix(0.03, 1.18, pow(blur, 0.85));
            let farRadius = mix(0.08, 2.8, blur * blur);
            let wideRadius = mix(0.14, 4.8, blur * blur);

            var accum = vec3<f32>(0.0);
            accum = accum + sampleEnvironment(dir, envMix, lightDir) * 0.08;
            accum = accum + sampleEnvironment(normalize(dir + tangent * nearRadius), envMix, lightDir) * 0.10;
            accum = accum + sampleEnvironment(normalize(dir - tangent * nearRadius), envMix, lightDir) * 0.10;
            accum = accum + sampleEnvironment(normalize(dir + bitangent * nearRadius), envMix, lightDir) * 0.10;
            accum = accum + sampleEnvironment(normalize(dir - bitangent * nearRadius), envMix, lightDir) * 0.10;
            accum = accum + sampleEnvironment(normalize(dir + (tangent + bitangent) * farRadius), envMix, lightDir) * 0.06;
            accum = accum + sampleEnvironment(normalize(dir + (tangent - bitangent) * farRadius), envMix, lightDir) * 0.06;
            accum = accum + sampleEnvironment(normalize(dir + (-tangent + bitangent) * farRadius), envMix, lightDir) * 0.06;
            accum = accum + sampleEnvironment(normalize(dir + (-tangent - bitangent) * farRadius), envMix, lightDir) * 0.06;
            accum = accum + sampleEnvironment(normalize(dir + tangent * wideRadius), envMix, lightDir) * 0.05;
            accum = accum + sampleEnvironment(normalize(dir - tangent * wideRadius), envMix, lightDir) * 0.05;
            accum = accum + sampleEnvironment(normalize(dir + bitangent * wideRadius), envMix, lightDir) * 0.05;
            accum = accum + sampleEnvironment(normalize(dir - bitangent * wideRadius), envMix, lightDir) * 0.05;
            return accum;
          }

          fn sampleEnvironmentAverage(envMix : f32, lightDir : vec3<f32>) -> vec3<f32> {
            var avg = vec3<f32>(0.0);
            avg = avg + sampleEnvironment(vec3<f32>(0.0, 1.0, 0.0), envMix, lightDir) * 0.24;
            avg = avg + sampleEnvironment(vec3<f32>(0.0, -1.0, 0.0), envMix, lightDir) * 0.08;
            avg = avg + sampleEnvironment(vec3<f32>(1.0, 0.0, 0.0), envMix, lightDir) * 0.14;
            avg = avg + sampleEnvironment(vec3<f32>(-1.0, 0.0, 0.0), envMix, lightDir) * 0.14;
            avg = avg + sampleEnvironment(vec3<f32>(0.0, 0.0, 1.0), envMix, lightDir) * 0.14;
            avg = avg + sampleEnvironment(vec3<f32>(0.0, 0.0, -1.0), envMix, lightDir) * 0.14;
            avg = avg + sampleEnvironment(normalize(vec3<f32>(0.7, 0.7, 0.0)), envMix, lightDir) * 0.06;
            avg = avg + sampleEnvironment(normalize(vec3<f32>(-0.7, 0.7, 0.0)), envMix, lightDir) * 0.06;
            return avg;
          }

          fn sampleDiffuseEnvironment(direction : vec3<f32>, envMix : f32, lightDir : vec3<f32>) -> vec3<f32> {
            let dir = normalize(direction);
            let lowFreq = sampleEnvironmentAverage(envMix, lightDir);
            let hemi = sampleEnvironmentBlurred(dir, 1.0, envMix, lightDir);
            let directionalBlend = 0.12 + 0.10 * saturate1(dir.y * 0.5 + 0.5);
            let lift = 0.16 + 0.18 * saturate1(dir.y * 0.5 + 0.5);
            return mix(lowFreq, hemi, directionalBlend) * lift;
          }

          fn sampleSpecularEnvironment(
            direction : vec3<f32>,
            normal : vec3<f32>,
            roughness : f32,
            envMix : f32,
            lightDir : vec3<f32>
          ) -> vec3<f32> {
            let clampedRoughness = clamp(roughness, 0.0, 1.0);
            let blur = pow(clampedRoughness, 0.72);
            let glossy = sampleEnvironmentBlurred(direction, blur, envMix, lightDir);
            let fallback = sampleEnvironmentBlurred(
              normalize(mix(direction, normal, 0.35 + 0.65 * blur)),
              min(1.0, 0.42 + blur * 0.85),
              envMix,
              lightDir
            );
            let diffuseProxy = sampleDiffuseEnvironment(normal, envMix, lightDir);
            let haze = mix(glossy, fallback, clamp(blur * blur * 0.95, 0.0, 1.0));
            let diffuseBlend = smoothstep(0.52, 1.0, clampedRoughness) * 0.74;
            return mix(haze, diffuseProxy, diffuseBlend);
          }

          fn sampleAmbientEnvironment(direction : vec3<f32>, envMix : f32, lightDir : vec3<f32>) -> vec3<f32> {
            if (envMix > 0.5) {
              return sampleDiffuseEnvironment(direction, envMix, lightDir);
            }
            return skyColor(direction) * (0.28 + 0.12 * direction.y);
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

          fn dielectricF0(ior : f32) -> f32 {
            let r = (ior - 1.0) / (ior + 1.0);
            return r * r;
          }

          fn intersectSphereRange(rayOrigin : vec3<f32>, rayDir : vec3<f32>) -> vec2<f32> {
            let oc = rayOrigin;
            let b = dot(oc, rayDir);
            let c = dot(oc, oc) - 1.0;
            let h = b * b - c;

            if (h < 0.0) {
              return vec2<f32>(-1.0, -1.0);
            }

            let sqrtH = sqrt(h);
            return vec2<f32>(-b - sqrtH, -b + sqrtH);
          }

          fn tintExtinction(tint : vec3<f32>, strength : f32) -> vec3<f32> {
            let neutral = vec3<f32>(0.18 * strength);
            let colored = max(vec3<f32>(0.05), (vec3<f32>(1.02) - tint * 0.92) * strength);
            return mix(neutral, colored, 0.82);
          }

          fn beerLambert(extinction : vec3<f32>, distance : f32) -> vec3<f32> {
            let e = -extinction * distance;
            return vec3<f32>(exp(e.x), exp(e.y), exp(e.z));
          }

          fn phaseHG(cosTheta : f32, anisotropy : f32) -> f32 {
            let g = clamp(anisotropy, -0.95, 0.95);
            let g2 = g * g;
            let denom = pow(max(1.0 + g2 - 2.0 * g * cosTheta, 0.0001), 1.5);
            return (1.0 - g2) / (12.5663706 * denom);
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
            let orbitPitch = uniforms.orbitPitchIorTransmissionSubsurface.x;
            let ior = uniforms.orbitPitchIorTransmissionSubsurface.y;
            let transmission = uniforms.orbitPitchIorTransmissionSubsurface.z;
            let subsurface = uniforms.orbitPitchIorTransmissionSubsurface.w;
            let absorption = uniforms.absorptionScatterDensityAnisotropy.x;
            let scatterDistance = uniforms.absorptionScatterDensityAnisotropy.y;
            let density = uniforms.absorptionScatterDensityAnisotropy.z;
            let anisotropy = uniforms.absorptionScatterDensityAnisotropy.w;
            let envMix = uniforms.paddingData.x;

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

            let background = sampleEnvironment(rayDir, envMix, lightDir);
            let lightColor = vec3<f32>(1.0, 0.97, 0.93) * lightIntensity;
            let sphereHits = intersectSphereRange(cameraPos, rayDir);
            let tNear = sphereHits.x;
            let tFar = sphereHits.y;

            if (tFar < 0.0) {
              let mapped = acesApprox(background * exposure);
              return vec4<f32>(gammaEncode(mapped), 1.0);
            }

            let entryT = max(tNear, 0.0);

            if (modelMode > 5.5) {
              let mediumDistance = max(tFar - entryT, 0.0);

              if (mediumDistance <= 0.0) {
                let mapped = acesApprox(background * exposure);
                return vec4<f32>(gammaEncode(mapped), 1.0);
              }

              let extinction = tintExtinction(baseColor, density);
              let phase = phaseHG(dot(lightDir, -rayDir), anisotropy);
              let stepCount = 20u;
              let stepSize = mediumDistance / f32(stepCount);
              var marchT = entryT + stepSize * 0.5;
              var transmittance = vec3<f32>(1.0, 1.0, 1.0);
              var scatterAccum = vec3<f32>(0.0, 0.0, 0.0);

              for (var i = 0u; i < stepCount; i = i + 1u) {
                let samplePos = cameraPos + rayDir * marchT;
                let lightHits = intersectSphereRange(samplePos + lightDir * 0.01, lightDir);
                let lightDistance = max(lightHits.y, 0.0);
                let lightTrans = beerLambert(extinction, lightDistance);
                let scatterStep = transmittance * lightTrans * baseColor * lightColor * phase * density * 1.65 * stepSize;
                scatterAccum = scatterAccum + scatterStep;
                transmittance = transmittance * beerLambert(extinction, stepSize);
                marchT = marchT + stepSize;
              }

              let ambientLift = sampleAmbientEnvironment(rayDir, envMix, lightDir) * baseColor * density * 0.18;
              let mapped = acesApprox((background * transmittance + scatterAccum + ambientLift) * exposure);
              return vec4<f32>(gammaEncode(mapped), 1.0);
            }

            let t = entryT;
            let hitPos = cameraPos + rayDir * t;
            let normal = normalize(hitPos);
            let viewDir = normalize(cameraPos - hitPos);
            let halfVec = normalize(lightDir + viewDir);
            let reflectView = reflect(-viewDir, normal);
            let rawNDotL = dot(normal, lightDir);
            let nDotL = max(rawNDotL, 0.0);
            let nDotV = max(dot(normal, viewDir), 0.0);
            let nDotH = max(dot(normal, halfVec), 0.0);
            let vDotH = max(dot(viewDir, halfVec), 0.0);
            let viewCos = max(dot(normal, viewDir), 0.0);

            var envSpecRoughness = roughness;
            if (modelMode > 0.5 && modelMode < 2.5) {
              envSpecRoughness = clamp(sqrt(2.0 / (max(shininess, 1.0) + 2.0)), 0.04, 1.0);
            }

            let ambientDiffuse = sampleAmbientEnvironment(normal, envMix, lightDir);
            let ambientSpecDir = normalize(mix(reflectView, normal, envSpecRoughness * envSpecRoughness));
            let ambientSpec = sampleSpecularEnvironment(ambientSpecDir, normal, envSpecRoughness, envMix, lightDir);

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
            } else if (modelMode < 3.5) {
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
            } else if (modelMode < 4.5) {
              let alpha = max(roughness * roughness, 0.02);
              let f0Scalar = dielectricF0(max(ior, 1.001));
              let f0 = vec3<f32>(f0Scalar);
              let fresnel = fresnelSchlick(viewCos, f0);
              let surfaceFresnel = fresnelSchlick(vDotH, f0);
              let distribution = ggxDistribution(nDotH, alpha);
              let geometry = smithGeometry(nDotL, nDotV, roughness);
              let surfaceSpec = (distribution * geometry) * surfaceFresnel / max(4.0 * nDotL * nDotV, 0.0001);
              let incidentDir = -viewDir;
              var innerDir = refract(incidentDir, normal, 1.0 / max(ior, 1.001));

              if (dot(innerDir, innerDir) < 0.0001) {
                innerDir = reflect(incidentDir, normal);
              }

              let interiorOrigin = hitPos + innerDir * 0.02;
              let interiorHits = intersectSphereRange(interiorOrigin, innerDir);
              let interiorDistance = max(interiorHits.y, 0.0);
              let exitPos = interiorOrigin + innerDir * interiorDistance;
              let exitNormal = normalize(exitPos);
              var exitDir = refract(innerDir, -exitNormal, max(ior, 1.001));

              if (dot(exitDir, exitDir) < 0.0001) {
                exitDir = reflect(innerDir, exitNormal);
              }

              let transmitDir = normalize(mix(exitDir, ambientSpecDir, roughness * roughness));
              let extinction = tintExtinction(baseColor, absorption);
              let attenuation = beerLambert(extinction, interiorDistance * 1.25);
              let refractedEnv = sampleEnvironmentBlurred(transmitDir, clamp(roughness * 1.15, 0.0, 1.0), envMix, lightDir) * attenuation;
              let reflectionEnv = ambientSpec * fresnel * specularLevel;
              let directSurface = surfaceSpec * lightColor * nDotL * specularLevel;
              let transmissionTerm = refractedEnv * transmission * (vec3<f32>(1.0) - fresnel);
              let bodyGlow = sampleAmbientEnvironment(exitDir, envMix, lightDir) * attenuation * transmission * 0.16;
              shaded = transmissionTerm + reflectionEnv + directSurface + bodyGlow;
            } else {
              let alpha = max(roughness * roughness, 0.05);
              let f0 = vec3<f32>(0.028);
              let surfaceFresnel = fresnelSchlick(vDotH, f0);
              let distribution = ggxDistribution(nDotH, alpha);
              let geometry = smithGeometry(nDotL, nDotV, roughness);
              let surfaceSpec = (distribution * geometry) * surfaceFresnel / max(4.0 * nDotL * nDotV, 0.0001);
              let wrap = saturate1((rawNDotL + subsurface * 1.2) / (1.0 + subsurface * 1.2));
              let inwardDir = -lightDir;
              let thickness = max(intersectSphere(hitPos + inwardDir * 0.02, inwardDir), 0.0);
              let scatterExtinction = tintExtinction(baseColor, 0.72 / max(scatterDistance, 0.18));
              let scatterTint = mix(baseColor, vec3<f32>(1.0, 0.84, 0.78), 0.3);
              let diffuse = baseColor / 3.14159265;
              let backScatterPhase = pow(saturate1(dot(viewDir, -lightDir)), mix(18.0, 6.0, subsurface));
              let rimTransmission = pow(1.0 - viewCos, mix(4.2, 2.0, subsurface));
              let thinRegion = exp(-thickness / max(scatterDistance * 1.45, 0.2));
              let diffusionFill = vec3<f32>(1.0) - beerLambert(scatterExtinction * 0.7, thickness * 0.9);
              let shadowLift = pow(saturate1(1.0 - rawNDotL * 0.55), 1.8);
              let transmittedLight =
                scatterTint *
                thinRegion *
                backScatterPhase *
                (0.3 + 0.7 * rimTransmission);
              let subsurfaceFill =
                mix(baseColor, scatterTint, 0.55) *
                diffusionFill *
                shadowLift *
                (0.28 + 0.72 * rimTransmission);
              let ambient = ambientDiffuse * mix(baseColor, scatterTint, 0.5) * 1.22;
              shaded =
                diffuse * lightColor * wrap * mix(1.0, 0.42, subsurface) +
                transmittedLight * lightColor * subsurface * 2.4 +
                subsurfaceFill * lightColor * subsurface * 0.95 +
                ambient +
                surfaceSpec * lightColor * max(rawNDotL * 0.55 + 0.45, 0.0) * 0.4 +
                ambientSpec * f0 * 0.06;
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

      this.rebuildBindGroup();

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
      this.uniformData[21] = this.sceneState.ior;
      this.uniformData[22] = this.sceneState.transmission;
      this.uniformData[23] = this.sceneState.subsurface;

      this.uniformData[24] = this.sceneState.absorption;
      this.uniformData[25] = this.sceneState.scatterDistance;
      this.uniformData[26] = this.sceneState.density;
      this.uniformData[27] = this.sceneState.anisotropy;

      this.uniformData[28] =
        this.sceneState.environmentSource === "hdr" && this.environmentReady
          ? 1
          : 0;
      this.uniformData[29] = 0;
      this.uniformData[30] = 0;
      this.uniformData[31] = 0;

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

  function setEnvironmentStatus(summary, detail, tone = "neutral") {
    environmentStatusBadge.textContent = summary;
    environmentStatusInline.textContent = summary;
    environmentStatusText.textContent = detail;

    environmentStatusBadge.classList.remove("is-live", "is-warning");
    environmentStatusInline.classList.remove("is-ready", "is-warning");

    if (tone === "ready") {
      environmentStatusBadge.classList.add("is-live");
      environmentStatusInline.classList.add("is-ready");
    } else if (tone === "warning") {
      environmentStatusBadge.classList.add("is-warning");
      environmentStatusInline.classList.add("is-warning");
    }
  }

  function refreshEnvironmentStatus() {
    const usingHdr = state.params.envSource === "hdr";

    if (!renderer) {
      setEnvironmentStatus("环境贴图准备中...", "正在初始化渲染器与环境资源。");
      return;
    }

    if (!usingHdr) {
      setEnvironmentStatus(
        "程序天空",
        "当前背景、反射与折射都使用程序天空；切换到 HDR 环境贴图即可启用本地环境采样。"
      );
      return;
    }

    if (renderer.environmentReady) {
      setEnvironmentStatus(
        "环境图已加载",
        `${HDR_ENVIRONMENT.label} 已用于背景、反射与折射采样，材质本身的颜色与参数仍由当前模型控制。`,
        "ready"
      );
      return;
    }

    if (window.location.protocol === "file:") {
      setEnvironmentStatus(
        "环境图未自动载入",
        "当前是 file:// 方式打开页面，浏览器通常会拦截对本地 .hdr 的自动读取。建议用 localhost 打开，或点击“手动载入环境贴图”选择同一张文件。",
        "warning"
      );
      return;
    }

    if (renderer.lastEnvironmentError) {
      setEnvironmentStatus(
        "环境图加载失败",
        `已回退到程序天空。错误信息：${renderer.lastEnvironmentError.message}`,
        "warning"
      );
      return;
    }

    setEnvironmentStatus("环境贴图准备中...", "正在尝试读取环境贴图资源。");
  }

  function updateRendererState() {
    if (renderer) {
      renderer.setState(buildRenderState());
    }
    refreshEnvironmentStatus();
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
      setEnvironmentStatus("环境贴图不可用", "WebGPU 初始化失败，因此环境贴图也无法参与实时采样。", "warning");
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

    loadHdrFileButton.addEventListener("click", () => {
      hdrFileInput.click();
    });

    hdrFileInput.addEventListener("change", async () => {
      const file = hdrFileInput.files?.[0];
      if (!file) {
        return;
      }

      setEnvironmentStatus("正在载入环境贴图...", `正在导入 ${file.name}。`);

      try {
        if (!renderer) {
          throw new Error("Renderer not ready");
        }

        await renderer.loadHdrEnvironmentFromFile(file);
        state.params.envSource = "hdr";
        renderControls();
        updateRendererState();
      } catch (error) {
        setEnvironmentStatus(
          "环境图导入失败",
          `手动导入 ${file.name} 时出错：${error.message}`,
          "warning"
        );
        console.error(error);
      } finally {
        hdrFileInput.value = "";
      }
    });

    initRenderer();
    refreshEnvironmentStatus();
  }

  init();
})();
