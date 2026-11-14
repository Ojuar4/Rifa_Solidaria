// ==========================================================
// COLE AQUI a URL do seu Apps Script (termina em /exec), depois
// de publicar o Google Sheets como banco de dados.
// ==========================================================
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz9ZprASgr91oS-tTTc5P5hWRrF9Q6LsBUMlMCaZVkUye28C3Wj-2RXlFWpdXiSJjSwgg/exec";

var WHATSAPP = "31991771837";
var PIX = "017.338.396-31"; // chave Pix (CPF)

var TOTAL = 300; // quantidade total de números da rifa

var numbersState = new Array(TOTAL).fill(null); // null = livre, true = reservado
var selected = new Set();

function pad3(n) { return String(n).padStart(3, "0"); }
function money(n) { return "R$ " + (n * 10).toFixed(2).replace(".", ","); }
function onlyDigits(s) { return String(s || "").replace(/\D/g, ""); }
function isConfigured() {
  return APPS_SCRIPT_URL && APPS_SCRIPT_URL.indexOf("COLE_AQUI") === -1;
}

function cellHtml(i) {
  var num = pad3(i + 1);
  var taken = numbersState[i];
  var cls = taken ? "cell taken" : (selected.has(i) ? "cell sel" : "cell");
  // LGPD: nunca mostrar quem reservou
  var title = taken ? ' title="Reservado"' : "";
  var disabled = taken ? " disabled" : "";
  return '<button type="button" class="' + cls + '" data-idx="' + i + '"' + title + disabled + ">" + num + "</button>";
}

function renderGrid() {
  var out = "";
  for (var i = 0; i < TOTAL; i++) { out += cellHtml(i); }
  document.getElementById("grid").innerHTML = out;
}

function updateFooter() {
  var n = selected.size;
  document.getElementById("selCount").textContent = n;
  document.getElementById("selTotal").textContent = money(n);
  var consent = document.getElementById("consent").checked;
  document.getElementById("reservarBtn").disabled = (n === 0 || !consent);
}

function renderAll() { renderGrid(); updateFooter(); }

function onGridClick(e) {
  var btn = e.target.closest(".cell");
  if (!btn || btn.classList.contains("taken")) return;
  var idx = parseInt(btn.dataset.idx, 10);
  if (selected.has(idx)) { selected.delete(idx); } else { selected.add(idx); }
  renderAll();
}

function showToast(msg) {
  var t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 4500);
}

function setStatus(msg) { document.getElementById("statusText").textContent = msg; }

// Recebe só os números reservados (sem nomes) e limpa da seleção
// os que outra pessoa acabou de reservar.
function applyReservas(reservas) {
  numbersState = new Array(TOTAL).fill(null);
  (reservas || []).forEach(function (r) {
    var idx = Number(r.numero) - 1;
    if (idx >= 0 && idx < TOTAL) { numbersState[idx] = true; }
  });
  var removed = 0;
  Array.from(selected).forEach(function (i) {
    if (numbersState[i]) { selected.delete(i); removed++; }
  });
  if (removed > 0) {
    showToast(removed + " número(s) que você escolheu foram reservados por outra pessoa.");
  }
}

function loadState() {
  if (!isConfigured()) {
    setStatus("⚠️ Configuração pendente: cole a URL do Apps Script no código.");
    return;
  }
  fetch(APPS_SCRIPT_URL)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      applyReservas(data.reservas);
      renderAll();
      var restantes = TOTAL - (data.reservas || []).length;
      setStatus(restantes + " número(s) ainda disponível(is).");
    })
    .catch(function () {
      setStatus("Não foi possível atualizar agora. Tente de novo em instantes.");
    });
}

function openWhats(chosen, name) {
  var wa = onlyDigits(WHATSAPP);
  if (wa.length <= 11) { wa = "55" + wa; }
  var msg = "Ola! Acabei de reservar os numeros da rifa da Lidiane: " + chosen.join(", ") +
    ". Total: " + money(chosen.length) + ". Meu nome: " + name +
    ". Vou fazer o pix (CPF) para: " + PIX;
  window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank");
}

function reservar() {
  var name = document.getElementById("buyerName").value.trim();
  var phoneRaw = document.getElementById("buyerPhone").value.trim();
  var phone = onlyDigits(phoneRaw);
  var consent = document.getElementById("consent").checked;

  if (!name || name.length < 2) { alert("Digite seu nome antes de reservar."); return; }
  if (phone.length === 12 || phone.length === 13) {
    if (phone.indexOf("55") === 0) { phone = phone.slice(2); }
  }
  if (phone.length < 10 || phone.length > 11) {
    alert("Digite um WhatsApp válido, com DDD (10 ou 11 dígitos).");
    return;
  }
  if (!consent) { alert("Para reservar, é preciso concordar com o uso dos seus dados."); return; }
  if (selected.size === 0) { return; }
  if (!isConfigured()) {
    alert("A rifa ainda não está totalmente configurada. Avise o organizador.");
    return;
  }

  var chosen = Array.from(selected).map(function (i) { return i + 1; });
  var chosenLabels = chosen.map(function (n) { return pad3(n); });
  var btn = document.getElementById("reservarBtn");
  btn.disabled = true;
  btn.textContent = "Reservando...";

  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ numeros: chosen, nome: name, telefone: phone, consentimento: true })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      btn.textContent = "Reservar";
      if (data.ok) {
        selected.clear();
        document.getElementById("buyerName").value = "";
        document.getElementById("buyerPhone").value = "";
        document.getElementById("consent").checked = false;
        loadState();
        openWhats(chosenLabels, name);
        showToast("Reserva feita! Confirme o pagamento pelo WhatsApp.");
      } else if (data.error === "numeros_indisponiveis") {
        alert("Alguém acabou de reservar antes de você o(s) número(s): " + (data.numeros || []).join(", ") + ". Atualizando a lista, escolha outro(s).");
        selected.clear();
        loadState();
      } else {
        alert("Não foi possível reservar agora. Tente novamente.");
        updateFooter();
      }
    })
    .catch(function () {
      btn.textContent = "Reservar";
      alert("Falha de conexão. Verifique sua internet e tente de novo.");
      updateFooter();
    });
}

// Link de contato do aviso de privacidade
(function () {
  var wa = onlyDigits(WHATSAPP);
  if (wa.length <= 11) { wa = "55" + wa; }
  var a = document.getElementById("privacyContact");
  if (a) { a.href = "https://wa.me/" + wa; }
})();

document.getElementById("grid").addEventListener("click", onGridClick);
document.getElementById("reservarBtn").addEventListener("click", reservar);
document.getElementById("refreshBtn").addEventListener("click", loadState);
document.getElementById("consent").addEventListener("change", updateFooter);

renderAll();
loadState();
setInterval(loadState, 12000);
