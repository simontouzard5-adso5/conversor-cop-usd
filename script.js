'use strict';

/* ==========================================================================
   CONVERSOR COP ⇄ USD — Lógica de la aplicación
   Organizado en: configuración, utilidades, validación, conversión,
   historial (localStorage), interfaz y eventos.
   ========================================================================== */

/* ---------- Configuración y constantes ---------- */

const HISTORY_STORAGE_KEY = 'currencyConverterHistory';
const MAX_HISTORY_ITEMS = 10;

const CURRENCY_INFO = {
  COP: { code: 'COP', name: 'Peso colombiano', locale: 'es-CO', badgeClass: 'badge--cop', decimals: 0 },
  USD: { code: 'USD', name: 'Dólar estadounidense', locale: 'en-US', badgeClass: 'badge--usd', decimals: 2 }
};

// Guarda el último resultado numérico calculado, útil al intercambiar monedas.
let lastResultValue = null;

/* ---------- Referencias al DOM (se completan en initApp) ---------- */

let elements = {};

/* ---------- Utilidades de formato ---------- */

/**
 * Formatea un número como moneda usando la configuración regional adecuada.
 * @param {number} value - Cantidad a formatear.
 * @param {'COP'|'USD'} currencyCode - Moneda destino del formato.
 * @returns {string} Cantidad formateada, ej: "$ 1.234.567".
 */
function formatCurrency(value, currencyCode) {
  const info = CURRENCY_INFO[currencyCode];
  return new Intl.NumberFormat(info.locale, {
    style: 'currency',
    currency: info.code,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals
  }).format(value);
}

/**
 * Formatea un número simple (sin símbolo de moneda) para mostrarlo en la fórmula.
 * @param {number} value
 * @returns {string}
 */
function formatPlainNumber(value) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Devuelve la fecha y hora actuales formateadas en español.
 * @returns {string} Ej: "2 jul 2026, 10:32 a. m."
 */
function getFormattedTimestamp() {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date());
}

/* ---------- Validación ---------- */

/**
 * Valida que un valor de texto represente un número positivo mayor que cero.
 * @param {string} rawValue - Valor tal como viene del input.
 * @param {string} fieldDescription - Descripción del campo para el mensaje de error.
 * @returns {{valid: boolean, value?: number, message?: string}}
 */
function validatePositiveNumber(rawValue, fieldDescription) {
  const trimmedValue = rawValue.trim();

  if (trimmedValue === '') {
    return { valid: false, message: `Ingresa ${fieldDescription}.` };
  }

  const numericValue = Number(trimmedValue);

  if (Number.isNaN(numericValue)) {
    return { valid: false, message: 'Ese valor no es un número válido.' };
  }

  if (numericValue <= 0) {
    return { valid: false, message: 'El valor debe ser un número positivo mayor que cero.' };
  }

  return { valid: true, value: numericValue };
}

/* ---------- Conversión ---------- */

/**
 * Convierte una cantidad entre COP y USD según la dirección indicada.
 * @param {number} amount - Cantidad a convertir.
 * @param {number} rate - Tasa de cambio (cuántos COP equivalen a 1 USD).
 * @param {'COP_USD'|'USD_COP'} direction - Sentido de la conversión.
 * @returns {{resultValue: number, targetCurrency: 'COP'|'USD', formula: string}}
 */
function convertCurrency(amount, rate, direction) {
  if (direction === 'COP_USD') {
    const resultValue = amount / rate;
    const formula = `${formatPlainNumber(amount)} COP ÷ ${formatPlainNumber(rate)} = ${formatCurrency(resultValue, 'USD')}`;
    return { resultValue, targetCurrency: 'USD', formula };
  }

  const resultValue = amount * rate;
  const formula = `${formatPlainNumber(amount)} USD × ${formatPlainNumber(rate)} = ${formatCurrency(resultValue, 'COP')}`;
  return { resultValue, targetCurrency: 'COP', formula };
}

/* ---------- Historial (localStorage) ---------- */

/**
 * Recupera el historial guardado en localStorage de forma segura.
 * @returns {Array<Object>}
 */
function loadHistory() {
  try {
    const storedData = localStorage.getItem(HISTORY_STORAGE_KEY);
    return storedData ? JSON.parse(storedData) : [];
  } catch (error) {
    console.error('No se pudo leer el historial guardado:', error);
    return [];
  }
}

/**
 * Persiste la lista de historial en localStorage.
 * @param {Array<Object>} historyList
 */
function saveHistory(historyList) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyList));
  } catch (error) {
    console.error('No se pudo guardar el historial:', error);
  }
}

/**
 * Agrega una nueva conversión al historial, manteniendo un máximo de elementos.
 * @param {Object} entry - Registro de la conversión realizada.
 */
function addHistoryEntry(entry) {
  const historyList = loadHistory();
  historyList.unshift(entry);
  const trimmedList = historyList.slice(0, MAX_HISTORY_ITEMS);
  saveHistory(trimmedList);
  renderHistory();
}

/**
 * Elimina un registro puntual del historial según su identificador.
 * @param {string} entryId
 */
function removeHistoryEntry(entryId) {
  const updatedList = loadHistory().filter((entry) => entry.id !== entryId);
  saveHistory(updatedList);
  renderHistory();
}

/** Vacía por completo el historial de conversiones. */
function clearAllHistory() {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
}

/** Dibuja el historial actual en la lista de la interfaz. */
function renderHistory() {
  const historyList = loadHistory();
  elements.historyList.innerHTML = '';

  if (historyList.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'history__empty';
    emptyItem.id = 'history-empty';
    emptyItem.textContent = 'Todavía no has hecho ninguna conversión.';
    elements.historyList.appendChild(emptyItem);
    return;
  }

  historyList.forEach((entry) => {
    elements.historyList.appendChild(buildHistoryItemElement(entry));
  });
}

/**
 * Construye el elemento <li> correspondiente a un registro del historial.
 * @param {Object} entry
 * @returns {HTMLLIElement}
 */
function buildHistoryItemElement(entry) {
  const item = document.createElement('li');
  item.className = 'history__item';

  const mainContent = document.createElement('div');
  mainContent.className = 'history__item-main';

  const conversionLine = document.createElement('p');
  conversionLine.className = 'history__item-conversion';
  conversionLine.textContent = `${entry.amountFormatted} → ${entry.resultFormatted}`;

  const timeLine = document.createElement('p');
  timeLine.className = 'history__item-time';
  timeLine.textContent = entry.timestamp;

  mainContent.appendChild(conversionLine);
  mainContent.appendChild(timeLine);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'history__item-remove';
  removeButton.dataset.entryId = entry.id;
  removeButton.setAttribute('aria-label', 'Eliminar esta conversión del historial');
  removeButton.textContent = '×';

  item.appendChild(mainContent);
  item.appendChild(removeButton);
  return item;
}

/* ---------- Interfaz: mensajes de error ---------- */

/**
 * Muestra un mensaje de error en un campo específico.
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement} errorEl
 * @param {string} message
 */
function showFieldError(inputEl, errorEl, message) {
  inputEl.classList.add('is-invalid');
  errorEl.textContent = message;
  errorEl.classList.add('is-visible');
}

/**
 * Limpia el mensaje de error de un campo específico.
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement} errorEl
 */
function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove('is-invalid');
  errorEl.textContent = '';
  errorEl.classList.remove('is-visible');
}

/** Limpia los mensajes de error de ambos campos del formulario. */
function clearAllFieldErrors() {
  clearFieldError(elements.amountInput, elements.amountError);
  clearFieldError(elements.rateInput, elements.rateError);
}

/* ---------- Interfaz: dirección de conversión y monedas ---------- */

/**
 * Actualiza etiquetas, insignias y prefijos según la dirección de conversión activa.
 * @param {'COP_USD'|'USD_COP'} direction
 */
function updateDirectionUI(direction) {
  const sourceCode = direction === 'COP_USD' ? 'COP' : 'USD';
  const targetCode = direction === 'COP_USD' ? 'USD' : 'COP';
  const sourceInfo = CURRENCY_INFO[sourceCode];
  const targetInfo = CURRENCY_INFO[targetCode];

  elements.labelFromCode.textContent = sourceInfo.code;
  elements.labelFromName.textContent = sourceInfo.name;
  elements.badgeFrom.className = `currency-chip__badge ${sourceInfo.badgeClass}`;

  elements.labelToCode.textContent = targetInfo.code;
  elements.labelToName.textContent = targetInfo.name;
  elements.badgeTo.className = `currency-chip__badge ${targetInfo.badgeClass}`;

  elements.amountPrefix.textContent = sourceInfo.code;
  elements.directionSelect.value = direction;
}

/* ---------- Interfaz: resultado ---------- */

/**
 * Muestra el resultado de la conversión con su fórmula y marca de tiempo.
 * @param {string} formattedResult
 * @param {string} formula
 */
function displayResult(formattedResult, formula) {
  elements.resultValue.textContent = formattedResult;
  elements.resultFormula.textContent = formula;
  elements.resultTimestamp.textContent = `Calculado el ${getFormattedTimestamp()}`;
  elements.resultBox.hidden = false;
}

/** Oculta el bloque de resultado y restablece su contenido. */
function hideResult() {
  elements.resultBox.hidden = true;
  elements.resultValue.textContent = '—';
  elements.resultFormula.textContent = '';
  elements.resultTimestamp.textContent = '';
  lastResultValue = null;
}

/* ---------- Lógica principal de conversión ---------- */

/** Ejecuta la validación, el cálculo y la actualización de la interfaz al convertir. */
function performConversion() {
  clearAllFieldErrors();

  const amountValidation = validatePositiveNumber(elements.amountInput.value, 'la cantidad a convertir');
  const rateValidation = validatePositiveNumber(elements.rateInput.value, 'la tasa de cambio');

  let firstInvalidField = null;

  if (!amountValidation.valid) {
    showFieldError(elements.amountInput, elements.amountError, amountValidation.message);
    firstInvalidField = firstInvalidField || elements.amountInput;
  }

  if (!rateValidation.valid) {
    showFieldError(elements.rateInput, elements.rateError, rateValidation.message);
    firstInvalidField = firstInvalidField || elements.rateInput;
  }

  if (firstInvalidField) {
    firstInvalidField.focus();
    return;
  }

  const direction = elements.directionSelect.value;
  const sourceCode = direction === 'COP_USD' ? 'COP' : 'USD';
  const { resultValue, targetCurrency, formula } = convertCurrency(
    amountValidation.value,
    rateValidation.value,
    direction
  );

  const formattedResult = formatCurrency(resultValue, targetCurrency);
  const formattedAmount = formatCurrency(amountValidation.value, sourceCode);

  displayResult(formattedResult, formula);
  lastResultValue = resultValue;

  addHistoryEntry({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    amountFormatted: formattedAmount,
    resultFormatted: formattedResult,
    timestamp: getFormattedTimestamp()
  });
}

/** Restablece el formulario a su estado inicial. */
function resetConverter() {
  elements.form.reset();
  clearAllFieldErrors();
  hideResult();
  elements.amountInput.focus();
}

/** Intercambia la dirección de conversión activa (COP↔USD) con una animación breve. */
function swapConversionDirection() {
  const currentDirection = elements.directionSelect.value;
  const newDirection = currentDirection === 'COP_USD' ? 'USD_COP' : 'COP_USD';

  // Si ya había un resultado, lo pasamos al campo de cantidad para agilizar
  // una conversión inmediata en el sentido contrario.
  if (lastResultValue !== null) {
    elements.amountInput.value = Number(lastResultValue.toFixed(4));
  }

  updateDirectionUI(newDirection);
  clearAllFieldErrors();
  hideResult();

  // Animación breve de retroalimentación visual en el botón y en los chips.
  elements.swapBtn.classList.add('is-swapping');
  elements.chipFrom.classList.add('is-pulsing');
  elements.chipTo.classList.add('is-pulsing');

  window.setTimeout(() => {
    elements.swapBtn.classList.remove('is-swapping');
    elements.chipFrom.classList.remove('is-pulsing');
    elements.chipTo.classList.remove('is-pulsing');
  }, 320);
}

/* ---------- Eventos ---------- */

/** Registra todos los listeners de eventos de la aplicación. */
function bindEvents() {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault(); // Evita recargar la página y permite usar Enter para convertir.
    performConversion();
  });

  elements.clearBtn.addEventListener('click', resetConverter);

  elements.swapBtn.addEventListener('click', swapConversionDirection);

  elements.directionSelect.addEventListener('change', () => {
    updateDirectionUI(elements.directionSelect.value);
    hideResult();
  });

  // Limpia el estado de error de un campo apenas el usuario empieza a corregirlo.
  elements.amountInput.addEventListener('input', () => {
    clearFieldError(elements.amountInput, elements.amountError);
  });

  elements.rateInput.addEventListener('input', () => {
    clearFieldError(elements.rateInput, elements.rateError);
  });

  elements.clearHistoryBtn.addEventListener('click', clearAllHistory);

  // Delegación de eventos para los botones "eliminar" de cada elemento del historial.
  elements.historyList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('.history__item-remove');
    if (removeButton) {
      removeHistoryEntry(removeButton.dataset.entryId);
    }
  });
}

/* ---------- Inicialización ---------- */

/** Obtiene y almacena las referencias a los elementos del DOM utilizados. */
function cacheElements() {
  elements = {
    form: document.getElementById('converter-form'),
    directionSelect: document.getElementById('direction-select'),

    amountInput: document.getElementById('amount-input'),
    amountError: document.getElementById('amount-error'),
    amountPrefix: document.getElementById('amount-prefix'),

    rateInput: document.getElementById('rate-input'),
    rateError: document.getElementById('rate-error'),

    convertBtn: document.getElementById('convert-btn'),
    clearBtn: document.getElementById('clear-btn'),
    swapBtn: document.getElementById('swap-btn'),

    chipFrom: document.getElementById('chip-from'),
    chipTo: document.getElementById('chip-to'),
    labelFromCode: document.getElementById('label-from-code'),
    labelFromName: document.getElementById('label-from-name'),
    labelToCode: document.getElementById('label-to-code'),
    labelToName: document.getElementById('label-to-name'),
    badgeFrom: document.querySelector('#chip-from .currency-chip__badge'),
    badgeTo: document.querySelector('#chip-to .currency-chip__badge'),

    resultBox: document.getElementById('result-box'),
    resultValue: document.getElementById('result-value'),
    resultFormula: document.getElementById('result-formula'),
    resultTimestamp: document.getElementById('result-timestamp'),

    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn')
  };
}

/** Punto de entrada de la aplicación. */
function initApp() {
  cacheElements();
  bindEvents();
  updateDirectionUI(elements.directionSelect.value);
  renderHistory();
}

document.addEventListener('DOMContentLoaded', initApp);
