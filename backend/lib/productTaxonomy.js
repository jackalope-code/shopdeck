const KEYBOARD_CATEGORY_IDS = new Set(['keyboards', 'keycaps', 'switches']);

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCategoryId(value) {
  return normalizeText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function classifyKeyboardItem(item = {}, sourceCategory = '') {
  const text = [item.name, item.productType, item.tags, item.itemType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/keycap|gmk|pbt|kat|dsa|sa\b/.test(text)) return 'keycaps';
  if (/switch|spring|stabilizer|lube|film|stem|housing/.test(text)) return 'switches';
  if (/deskmat|cable|wrist\s*rest|artisan|puller|tool|storage|misc|accessor/.test(text)) return 'accessories';
  if (/\bpcb\b|plate|daughterboard|foam|gasket|weights?\b|mounting/.test(text)) return 'parts';
  if (/pre.?built|fully built|keyboard kit|\bkit\b|mechanical keyboard|alice|\btkl\b|\b65%\b|\b75%\b|\b60%\b/.test(text)) return 'full';
  if (/barebone/.test(text)) return 'parts';

  const source = String(sourceCategory || '').toLowerCase();
  if (source === 'keycaps') return 'keycaps';
  if (source === 'switches') return 'switches';
  if (source === 'accessories') return 'accessories';
  if (source === 'keyboards') return 'full';
  return 'accessories';
}

function classifyElectronicsSubcategory(item = {}, rawCategory = '') {
  const category = normalizeCategoryId(rawCategory);
  const text = [item.name, item.productType, item.tags, item.itemType, rawCategory]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (category === 'ram' || /\bddr[345]\b|memory kit|sodimm|udimm|rdimm|ecc/.test(text)) return 'ram';
  if (category === 'gpu' || /\brtx\b|\brx\b|graphics card|gpu|geforce|radeon/.test(text)) return 'gpu';
  if (category.includes('microcontroller') || /microcontroller|arduino|esp32|rp2040|stm32|teensy|development board/.test(text)) return 'microcontrollers';
  if (category.includes('passive') || /resistor|capacitor|inductor|ferrite|ceramic capacitor/.test(text)) return 'passives';
  if (category.includes('sensor') || /sensor|imu|accelerometer|gyroscope|environmental|temperature sensor|pressure sensor/.test(text)) return 'sensors';
  if (category.includes('motor') || category.includes('actuator') || /stepper|servo|dc motor|actuator|solenoid/.test(text)) return 'motors';
  if (category === 'ics' || category.includes('breakout') || /\bic\b|op-amp|logic gate|breakout|driver chip|amplifier/.test(text)) return 'ics';
  if (category.includes('encoder') || category.includes('potentiometer') || /encoder|potentiometer|rotary knob/.test(text)) return 'encoders';
  if (category.includes('power') || /power supply|buck converter|boost converter|battery|charger|voltage regulator/.test(text)) return 'power';
  if (category.includes('connector') || /connector|header|terminal block|usb cable|socket/.test(text)) return 'connectors';
  if (category.includes('display') || /display|lcd|oled|epaper|screen|monitor/.test(text)) return 'displays';
  if (category.includes('wireless') || /wifi|bluetooth|lora|zigbee|wireless/.test(text)) return 'wireless';
  if (category.includes('audio') || /microphone|speaker|dac|audio|headphone/.test(text)) return 'audio';
  return 'general';
}

function classifyProductTaxonomy(input = {}) {
  const rawCategory = String(input.category || '').trim();
  const normalizedCategory = normalizeCategoryId(rawCategory);
  const text = [input.name, input.productType, input.tags, input.itemType, rawCategory]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const keyboardLike = KEYBOARD_CATEGORY_IDS.has(normalizedCategory)
    || /keyboard|keycap|switch|deskmat|stabilizer|pcb|plate|gmk|pbt/.test(text);

  if (keyboardLike) {
    return {
      analyticsCategory: 'keyboards',
      analyticsSubcategory: classifyKeyboardItem(input, rawCategory),
    };
  }

  const electronicsLike = !normalizedCategory
    || normalizedCategory === 'electronics'
    || normalizedCategory === 'components'
    || normalizedCategory === 'audio'
    || normalizedCategory === 'ram'
    || normalizedCategory === 'gpu'
    || normalizedCategory.startsWith('microcontroller')
    || normalizedCategory.startsWith('passive')
    || normalizedCategory.startsWith('sensor')
    || normalizedCategory.startsWith('motor')
    || normalizedCategory.startsWith('ic')
    || normalizedCategory.startsWith('encoder')
    || normalizedCategory.startsWith('power')
    || normalizedCategory.startsWith('connector')
    || normalizedCategory.startsWith('display')
    || normalizedCategory.startsWith('wireless');

  if (electronicsLike) {
    return {
      analyticsCategory: 'electronics',
      analyticsSubcategory: classifyElectronicsSubcategory(input, rawCategory),
    };
  }

  return {
    analyticsCategory: normalizedCategory || 'general',
    analyticsSubcategory: null,
  };
}

function isMouserDerived(input = {}) {
  const vendor = normalizeText(input.vendor);
  const url = normalizeText(input.url);
  return vendor.includes('mouser') || url.includes('mouser.');
}

module.exports = {
  classifyKeyboardItem,
  classifyProductTaxonomy,
  isMouserDerived,
};