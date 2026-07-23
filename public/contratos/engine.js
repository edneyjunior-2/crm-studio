/* =====================================================================
   CRM STUDIO — MOTOR GENÉRICO DO GERADOR DE CONTRATOS
   =====================================================================
   Este arquivo NÃO contém nenhum dado de nenhum tenant (nomes de empresa,
   texto de cláusula, timbrado, etc). Toda informação específica de marca
   vem de `window.CONTRATO_CONFIG`, que o HTML do tenant declara ANTES de
   incluir este script:

     <script>
       window.CONTRATO_CONFIG = { timbradoDataUri, contractModels, ... };
     </script>
     <script src="https://app.crmstudio.com.br/contratos/engine.js?v=1"></script>

   Ver public/contratos/_starter/README.md para a documentação completa
   do formato de CONTRATO_CONFIG.

   IMPORTANTE — PROTOCOLO DE FIO COM O CRM (NÃO ALTERAR):
   O evento postMessage disparado ao gerar um PDF é sempre
   `{ type: 'aurum_contrato_gerado', ... }`, mesmo para tenants que não são
   a Aurum. O nome é histórico (nasceu junto com o template da Aurum) mas
   hoje é o protocolo genérico que TODO template de contrato usa para
   avisar o CRM Studio (React) que um contrato foi gerado — o lado React
   (src/components/crm/contratos/contratos-view.tsx) faz
   `if (e.data?.type !== 'aurum_contrato_gerado') return`. Renomear essa
   string quebra a integração para qualquer tenant, não só a Aurum.
   ===================================================================== */

(function () {
  'use strict';

  var cfg = window.CONTRATO_CONFIG || {};

  /* =====================================================================
     TIMBRADO — imagem de fundo do PDF (base64), vem 100% da config
     ===================================================================== */
  var TIMBRADO_DATA_URI = cfg.timbradoDataUri || '';

  /* =====================================================================
     CONTRATO — blocos com placeholders {{X}} e grupos condicionais [...]
     Regras:
       {{X}}    → substitui pelo valor do campo X
       [texto]  → grupo condicional: se algum {{Y}} dentro do grupo
                  estiver DESATIVADO, o grupo inteiro some.
                  Se Y estiver vazio/ativo, o grupo permanece e Y vira {{Y}}
                  no PDF (para o usuario notar e preencher).

     Modelos de contrato disponíveis (selecionáveis nas abas). Cada modelo
     tem seu próprio texto padrão e sua própria chave de edição no
     localStorage — editar/restaurar um NÃO afeta o outro. Vem inteiro da
     config (window.CONTRATO_CONFIG.contractModels).
     ===================================================================== */
  var CONTRACT_MODELS = cfg.contractModels || {};
  var contractModelKeys = Object.keys(CONTRACT_MODELS);
  var currentContract = CONTRACT_MODELS.nova ? 'nova' : contractModelKeys[0];

  function modeloAtual() {
    return CONTRACT_MODELS[currentContract] || CONTRACT_MODELS[contractModelKeys[0]];
  }

  /* Cláusulas efetivas de um modelo específico (edições salvas ou padrão). */
  function clausulasDoModelo(key) {
    var m = CONTRACT_MODELS[key] || modeloAtual();
    try {
      var raw = localStorage.getItem(m.storageKey);
      if (raw) { var p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
    } catch (e) {}
    return m.blocks;
  }

  function loadClauses() {
    var m = modeloAtual();
    try {
      var raw = localStorage.getItem(m.storageKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { console.warn('Não foi possível ler cláusulas salvas:', e); }
    return JSON.parse(JSON.stringify(m.blocks));
  }
  function persistClauses() {
    try { localStorage.setItem(modeloAtual().storageKey, JSON.stringify(CONTRACT_BLOCKS)); }
    catch (e) { toast('Falha ao salvar localmente.'); }
  }
  var CONTRACT_BLOCKS = loadClauses();

  /* =====================================================================
     ESTADO: campos desativados + modo PJ/PF
     ===================================================================== */
  var disabledFields = new Set();
  var currentMode = cfg.defaultMode || 'pj';   // 'pj' ou 'pf'

  function setModo(modo) {
    currentMode = modo;
    document.body.classList.toggle('mode-pj', modo === 'pj');
    document.body.classList.toggle('mode-pf', modo === 'pf');
    var btnPJ = document.getElementById('btn-modo-pj');
    var btnPF = document.getElementById('btn-modo-pf');
    if (btnPJ) btnPJ.classList.toggle('active', modo === 'pj');
    if (btnPF) btnPF.classList.toggle('active', modo === 'pf');
    schedulePreview();
    atualizarEstadoBtnDocusign();
  }

  /* =====================================================================
     FORMATACAO
     ===================================================================== */
  var MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  function formatDateExt(isoDate) {
    if (!isoDate) return '';
    var partes = isoDate.split('-');
    var y = partes[0], m = partes[1], d = partes[2];
    return parseInt(d,10).toString().padStart(2,'0') + ' de ' + MESES[parseInt(m,10)-1] + ' de ' + y;
  }

  /* numero por extenso em pt-BR — 0 a 100, suporta decimal "vinte e cinco" / "trinta inteiros e cinco decimos" */
  var NUM_UNI = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove',
                   'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  var NUM_DEZ = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  function inteiroPorExtenso(n) {
    if (n < 0) return '';
    if (n < 20) return NUM_UNI[n];
    if (n < 100) {
      var d = Math.floor(n/10), u = n%10;
      return u === 0 ? NUM_DEZ[d] : (NUM_DEZ[d] + ' e ' + NUM_UNI[u]);
    }
    if (n === 100) return 'cem';
    return String(n); // fallback acima de 100
  }
  function numeroPorExtenso(valor) {
    if (valor === '' || valor == null) return '';
    var num = Number(String(valor).replace(',','.'));
    if (isNaN(num)) return '';
    // inteiro
    if (Number.isInteger(num)) return inteiroPorExtenso(num);
    // decimal: ex 12.5 → "doze inteiros e cinco décimos"
    var partes = String(num).split('.');
    var inteiro = parseInt(partes[0], 10);
    var dec = partes[1] || '';
    var decNum = parseInt(dec, 10);
    var intExt = inteiroPorExtenso(inteiro);
    var decExt = inteiroPorExtenso(decNum);
    var sufixo = dec.length === 1 ? (decNum === 1 ? 'décimo' : 'décimos')
                 : dec.length === 2 ? (decNum === 1 ? 'centésimo' : 'centésimos')
                 : 'milésimos';
    return intExt + ' inteiros e ' + decExt + ' ' + sufixo;
  }

  function getFieldValues() {
    var data = {};
    document.querySelectorAll('[data-field]').forEach(function (input) {
      var name = input.dataset.field;
      // se o campo nao pertence ao modo atual (escondido pela classe pj-only/pf-only) → ignora
      var visible = input.offsetParent !== null;
      if (!visible || disabledFields.has(name)) {
        data[name] = '';
      } else {
        data[name] = input.value.trim();
      }
    });
    // derivados
    data.DATA_ASSINATURA_EXT = formatDateExt(data.DATA_ASSINATURA);
    if (disabledFields.has('DATA_ASSINATURA')) data.DATA_ASSINATURA_EXT = '';

    data.COMISSAO_EXT = numeroPorExtenso(data.COMISSAO_PCT);
    if (disabledFields.has('COMISSAO_PCT')) data.COMISSAO_EXT = '';

    // flexão de gênero (PF) a partir de PF_SEXO — feminino quando explicitamente marcado
    var fem = data.PF_SEXO === 'feminino';
    var ESTADO_CIVIL_FEM = {
      'solteiro': 'solteira',
      'casado': 'casada',
      'divorciado': 'divorciada',
      'viúvo': 'viúva',
      'união estável': 'união estável',
    };
    if (data.PF_ESTADO_CIVIL && fem) {
      data.PF_ESTADO_CIVIL = ESTADO_CIVIL_FEM[data.PF_ESTADO_CIVIL] || data.PF_ESTADO_CIVIL;
    }
    data.PF_INSCRITO = fem ? 'inscrita' : 'inscrito';
    data.PF_DOMICILIADO = fem ? 'domiciliada' : 'domiciliado';
    data.PF_DENOMINADO = fem ? 'denominada' : 'denominado';
    if (fem && data.PF_NACIONALIDADE === 'brasileiro') data.PF_NACIONALIDADE = 'brasileira';
    return data;
  }

  /* Dados da MINUTA genérica: mantém os dados fixos do timbrado/empresa e as
     condições comerciais (comissão), mas zera tudo que identifica o parceiro
     — no PDF esses campos viram linhas para preencher. */
  function getMinutaData() {
    var d = getFieldValues();
    var camposParceiro = [
      'PARCEIRO_RAZAO','PARCEIRO_CNPJ','PARCEIRO_ENDERECO',
      'REP_CARGO','REP_NOME','REP_NACIONALIDADE','REP_CPF','REP_RG','REP_EMAIL',
      'PF_NOME','PF_NACIONALIDADE','PF_ESTADO_CIVIL','PF_PROFISSAO',
      'PF_CPF','PF_RG','PF_ENDERECO','PF_EMAIL',
    ];
    camposParceiro.forEach(function (k) { d[k] = ''; });
    // Sócios/responsáveis adicionais (REP2_*, REP3_*, ...) — zera por padrão
    // de nome de campo, já que a quantidade é dinâmica (ver criarGrupoRepExtra)
    // e não dá pra listar um por um como os campos fixos acima.
    Object.keys(d).forEach(function (k) {
      if (/^REP\d+_/.test(k)) d[k] = '';
    });
    d.DATA_ASSINATURA = ''; d.DATA_ASSINATURA_EXT = '';
    return d;
  }

  /* =====================================================================
     SUBSTITUICAO com suporte a grupos condicionais [...]
     Um grupo eh REMOVIDO se algum {{X}} dentro dele estiver desativado.
     Se nenhum X esta desativado, o grupo permanece e os {{X}} viram
     valor (ou ficam como {{X}} no PDF se vazios — para o usuario notar).
     ===================================================================== */
  function substitute(text, data, minuta) {
    minuta = minuta || false;
    // 1) Resolver grupos condicionais
    // Grupos podem aninhar simples — assumimos sem aninhamento profundo
    text = text.replace(/\[([^\[\]]*)\]/g, function (full, inner) {
      // pegar todos os placeholders dentro desse grupo
      var matches = [].concat.apply([], [...inner.matchAll(/\{\{([A-Z_0-9]+)\}\}/g)].map(function (m) { return [m[1]]; }));
      // se algum desses campos esta desativado → remove o grupo inteiro
      // (na minuta genérica mantemos todos os grupos, com espaços p/ preencher)
      for (var i = 0; i < matches.length; i++) {
        var key = matches[i];
        // campos derivados → mapeiam pro pai
        var realKey = key;
        if (key === 'DATA_ASSINATURA_EXT') realKey = 'DATA_ASSINATURA';
        if (key === 'COMISSAO_EXT') realKey = 'COMISSAO_PCT';
        if (!minuta && disabledFields.has(realKey)) return '';
      }
      return inner;
    });

    // 2) Substituir placeholders restantes. Na minuta, campo vazio vira uma
    // linha para preencher; fora dela, mantém {{X}} para o usuário notar.
    text = text.replace(/\{\{([A-Z_0-9]+)\}\}/g, function (m, key) {
      var v = data[key];
      if (v && v !== '') return v;
      return minuta ? '__________' : ('{{' + key + '}}');
    });

    // 3) Limpeza de virgulas/espacos sobrando depois da remocao de grupos
    text = text.replace(/\s+,/g, ',');
    text = text.replace(/,\s*,/g, ',');
    text = text.replace(/\s+\./g, '.');
    text = text.replace(/\(\s*\)/g, '');
    text = text.replace(/  +/g, ' ').trim();

    return text;
  }

  /* filtra os blocos pelo modo PJ/PF atual; se `data` for passado, também
     expande os marcadores de sócio adicional (ver expandirBlocosComSocios) —
     sem `data` (ex.: editor de cláusulas, que edita o molde bruto), pula a
     expansão e devolve os blocos como estão. */
  function activeBlocks(src, data) {
    src = src || CONTRACT_BLOCKS;
    var filtrados = src.filter(function (b) { return !b.mode || b.mode === currentMode; });
    return data ? expandirBlocosComSocios(filtrados, data) : filtrados;
  }

  /* =====================================================================
     SÓCIOS/RESPONSÁVEIS ADICIONAIS — expansão dinâmica de blocos
     O template declara UMA VEZ, por modelo de contrato, um par de blocos
     marcadores logo após o parágrafo/assinatura do representante principal:
       { type: 'rep-extra-qualificacao', mode: 'pj', text: '...{{CARGO}} {{NOME}}...' }
       { type: 'rep-extra-sign',         mode: 'pj', text: '[{{NOME}} ](CONTRATANTE)' }
     Os placeholders desses blocos usam nomes GENÉRICOS ({{NOME}}, {{CARGO}},
     ...) porque o índice do sócio só se sabe em tempo de geração. Pra cada
     grupo "Representante Legal" extra (clonado via criarGrupoRepExtra, com
     `data-rep-group="N"`, N > 1) que tiver o NOME preenchido, o marcador vira
     um bloco real (`type: 'p'`/`'sign'`) com os placeholders remapeados pra
     REP{N}_CARGO, REP{N}_NOME etc. — que `getFieldValues()` já coleta de
     forma genérica, sem precisar de nenhuma mudança na coleta de campos.
     Sem nenhum sócio extra preenchido, os marcadores somem silenciosamente
     (PDF sai idêntico ao de hoje, com só o representante principal). */
  function indicesRepExtras() {
    var indices = [];
    document.querySelectorAll('[data-rep-group]').forEach(function (el) {
      var idx = parseInt(el.dataset.repGroup, 10);
      if (idx > 1) indices.push(idx);
    });
    indices.sort(function (a, b) { return a - b; });
    return indices;
  }

  function remapPlaceholdersParaIndice(text, idx) {
    return text.replace(/\{\{([A-Z_0-9]+)\}\}/g, function (m, key) {
      return '{{REP' + idx + '_' + key + '}}';
    });
  }

  function expandirBlocosComSocios(blocks, data) {
    var indicesPreenchidos = indicesRepExtras().filter(function (idx) {
      return !!(data['REP' + idx + '_NOME'] && data['REP' + idx + '_NOME'].trim());
    });
    var out = [];
    blocks.forEach(function (b) {
      if (b.type === 'rep-extra-qualificacao' || b.type === 'rep-extra-sign') {
        var tipoReal = b.type === 'rep-extra-sign' ? 'sign' : 'p';
        indicesPreenchidos.forEach(function (idx) {
          out.push({ type: tipoReal, mode: b.mode, text: remapPlaceholdersParaIndice(b.text, idx) });
        });
        return;
      }
      out.push(b);
    });
    return out;
  }

  function countPendentes(data) {
    var count = 0;
    var seen = new Set();
    activeBlocks(undefined, data).forEach(function (b) {
      var resolved = substitute(b.text, data);
      var ms = resolved.match(/\{\{([A-Z_0-9]+)\}\}/g);
      if (ms) ms.forEach(function (k) {
        if (!seen.has(k)) { seen.add(k); count++; }
      });
    });
    return count;
  }

  /* =====================================================================
     GERADOR DE PDF (jsPDF)
     Margens calibradas para o timbrado oficial:
       topo  = 45mm  (barra navy termina em ~30mm)
       baixo = 50mm  (barra cinza + endereco ocupam ~30mm finais)
     ===================================================================== */
  var lastBlobUrl = null;

  // Captura do PDF recém-salvo p/ enviar ao CRM via postMessage (ver histAdd()
  // mais abaixo) — preenchidos logo após doc.save(), antes de qualquer mutação
  // futura no doc, garantindo que é exatamente o mesmo conteúdo baixado.
  var lastPdfBase64 = '';
  var lastPdfFileName = '';

  async function gerarPdfContrato(data, autoSave, minuta) {
    minuta = minuta || false;
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });

    var pageW = doc.internal.pageSize.getWidth();   // 210
    var pageH = doc.internal.pageSize.getHeight();  // 297

    var marginTop    = 42;
    var marginBottom = 46;
    var marginLeft   = 22;
    var marginRight  = 22;
    var usableW = pageW - marginLeft - marginRight;
    var lineHeight = 5.1;
    var paragraphGap = 1.8;

    function drawTimbrado() {
      doc.addImage(TIMBRADO_DATA_URI, 'JPEG', 0, 0, pageW, pageH);
      if (minuta) {
        doc.setFont('times', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(150, 150, 150);
        doc.text('MINUTA — SUJEITA A REVISÃO', pageW / 2, marginTop - 5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
    }
    var y = marginTop;
    drawTimbrado();

    function ensureSpace(h) {
      if (y + h > pageH - marginBottom) {
        doc.addPage();
        drawTimbrado();
        y = marginTop;
      }
    }

    // altura aproximada de cada bloco — usada para "keep-together"
    function blockHeight(block) {
      var text = substitute(block.text, data, minuta);
      if (!text) return 0;
      if (block.type === 'h1') return 14;
      if (block.type === 'h2') {
        var lines = doc.splitTextToSize(text, usableW);
        return lines.length * lineHeight + 6;
      }
      if (block.type === 'right') {
        var linesR = doc.splitTextToSize(text, usableW);
        return linesR.length * lineHeight + 8 + paragraphGap;
      }
      if (block.type === 'sign') return 20;
      var linesP = doc.splitTextToSize(text, usableW);
      return linesP.length * lineHeight + paragraphGap;
    }

    function drawBlock(block, idx, all) {
      var text = substitute(block.text, data, minuta);
      if (!text) return;

      if (block.type === 'h1') {
        doc.setFont('times', 'bold');
        doc.setFontSize(13.5);
        ensureSpace(12);
        doc.text(text, pageW / 2, y + 5, { align: 'center' });
        y += 14;
      } else if (block.type === 'h2') {
        doc.setFont('times', 'bold');
        doc.setFontSize(11.5);
        var lines = doc.splitTextToSize(text, usableW);
        // mantém o título junto com a primeira linha do parágrafo seguinte
        var next = all[idx + 1];
        var nextH = next ? Math.min(lineHeight + 4, blockHeight(next)) : 0;
        ensureSpace(lines.length * lineHeight + 6 + nextH);
        y += 4;
        lines.forEach(function (l) { doc.text(l, marginLeft, y + 4); y += lineHeight; });
        y += 2;
      } else if (block.type === 'right') {
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        var linesR = doc.splitTextToSize(text, usableW);
        // tenta manter a data + assinaturas seguintes na mesma página
        var groupH = linesR.length * lineHeight + 8 + paragraphGap;
        for (var i = idx + 1; i < all.length && all[i].type === 'sign'; i++) {
          groupH += blockHeight(all[i]);
        }
        ensureSpace(groupH);
        y += 8;
        linesR.forEach(function (l) { doc.text(l, pageW - marginRight, y + 4, { align: 'right' }); y += lineHeight; });
        y += paragraphGap;
      } else if (block.type === 'sign') {
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        // keep-together com sigs subsequentes
        var groupHs = 20;
        for (var j = idx + 1; j < all.length && all[j].type === 'sign'; j++) {
          groupHs += blockHeight(all[j]);
        }
        ensureSpace(groupHs);
        y += 11;
        doc.setLineWidth(0.3);
        var lineLen = Math.min(120, usableW);
        doc.line((pageW - lineLen)/2, y, (pageW + lineLen)/2, y);
        y += 5;
        doc.text(text, pageW / 2, y, { align: 'center' });
        y += 4;
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        var linesP = doc.splitTextToSize(text, usableW);
        ensureSpace(lineHeight);
        linesP.forEach(function (l) {
          if (y + lineHeight > pageH - marginBottom) {
            doc.addPage();
            drawTimbrado();
            y = marginTop;
          }
          doc.text(l, marginLeft, y + 4);
          y += lineHeight;
        });
        y += paragraphGap;
      }
    }

    // Para a minuta genérica, o modelo usado pode ser configurado por
    // `cfg.minutaModelKey` (ex: a Aurum sempre usa a versão "antiga" para a
    // minuta). Se não configurado ou a chave não existir, cai no modelo
    // atualmente selecionado nas abas.
    var minutaKey = (cfg.minutaModelKey && CONTRACT_MODELS[cfg.minutaModelKey])
      ? cfg.minutaModelKey
      : currentContract;
    var blocks = activeBlocks(minuta ? clausulasDoModelo(minutaKey) : CONTRACT_BLOCKS, data);
    blocks.forEach(function (b, i, all) { drawBlock(b, i, all); });

    var nomeParceiro = currentMode === 'pf' ? data.PF_NOME : data.PARCEIRO_RAZAO;
    var slug = (nomeParceiro || 'Parceiro').replace(/[^a-zA-Z0-9]+/g, '_');
    var prefixo = cfg.documentPrefix ? (cfg.documentPrefix + '_') : '';
    // Nome do arquivo reflete o MODELO/aba usado (chave de contractModels),
    // não mais fixo em "Parceria" — tenant com mais de um modelo (ex.:
    // honorários advocatícios + parceria) baixava tudo com nome de
    // "Contrato_Parceria_..." mesmo quando o modelo usado era outro.
    var modeloLabel = currentContract ? (currentContract.charAt(0).toUpperCase() + currentContract.slice(1)) : 'Parceria';
    var fileName = minuta
      ? (cfg.minutaFileName || 'Minuta_Contrato.pdf')
      : ('Contrato_' + modeloLabel + '_' + prefixo + slug + '.pdf');
    if (autoSave) {
      doc.save(fileName);
      // Base64 do MESMO doc que acabou de ser salvo (nenhuma mutação depois
      // disso) — é o que histAdd() manda pro CRM via postMessage.
      var datauri = doc.output('datauristring');
      lastPdfBase64 = datauri.slice(datauri.indexOf(',') + 1);
      lastPdfFileName = fileName;
    }
    return doc;
  }

  /* =====================================================================
     PREVIEW VIA IFRAME (com debounce)
     ===================================================================== */
  var previewTimer = null;
  var loadingEl = document.getElementById('preview-loading');

  // O navegador consegue exibir PDF embutido? (Chrome 94+/Firefox/Safari 16.4+ expõem a flag.)
  // Se a flag não existir (navegador antigo), assume que sim — comportamento original.
  // Se o usuário tiver "baixar PDF em vez de abrir" ligado, esta flag vem false.
  var PDF_INLINE_OK = (typeof navigator.pdfViewerEnabled === 'boolean')
    ? navigator.pdfViewerEnabled
    : true;

  var fallbackEl = document.getElementById('preview-fallback');
  var fallbackTitle = document.getElementById('preview-fallback-title');
  var fallbackMsg = document.getElementById('preview-fallback-msg');
  function showFallback(title, msg) {
    if (title) fallbackTitle.textContent = title;
    if (msg) fallbackMsg.textContent = msg;
    fallbackEl.classList.add('show');
  }
  function hideFallback() { fallbackEl.classList.remove('show'); }
  var btnPreviewOpen = document.getElementById('btn-preview-open');
  if (btnPreviewOpen) {
    btnPreviewOpen.addEventListener('click', function () {
      if (lastBlobUrl) window.open(lastBlobUrl, '_blank');
      else toast('Preencha ao menos um campo para gerar a pré-visualização.');
    });
  }

  function atualizarBadgePendentes(data) {
    var pend = countPendentes(data);
    var badge = document.getElementById('pendentes-badge');
    if (!badge) return;
    if (pend === 0) {
      badge.textContent = '✓ Tudo preenchido';
      badge.classList.add('zero');
    } else {
      badge.textContent = pend + ' ' + (pend === 1 ? 'campo pendente' : 'campos pendentes');
      badge.classList.remove('zero');
    }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    if (loadingEl) loadingEl.classList.add('show');
    previewTimer = setTimeout(updatePreview, 250);
  }
  async function updatePreview() {
    try {
      // Guarda: jsPDF não carregou (CDN bloqueado por rede/antivírus/extensão)
      if (!window.jspdf || !window.jspdf.jsPDF) {
        showFallback(
          'Não foi possível carregar o gerador de PDF',
          'A biblioteca de geração (jsPDF) foi bloqueada pela sua rede, antivírus ou alguma extensão do navegador. Libere o acesso a cdnjs.cloudflare.com / jsdelivr.net e recarregue a página.'
        );
        return;
      }
      var data = getFieldValues();
      var doc = await gerarPdfContrato(data, false);
      var blob = doc.output('blob');
      if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
      lastBlobUrl = URL.createObjectURL(blob);

      if (PDF_INLINE_OK) {
        hideFallback();
        var previewFrame = document.getElementById('pdf-preview');
        if (previewFrame) previewFrame.src = lastBlobUrl + '#toolbar=0&navpanes=0';
      } else {
        // Navegador não renderiza PDF embutido — a geração funciona, só não dá pra mostrar aqui.
        showFallback(
          'Pré-visualização indisponível neste navegador',
          'Seu navegador está configurado para baixar PDFs em vez de exibi-los. Os dados estão sendo salvos normalmente — clique abaixo para abrir a pré-visualização atualizada numa nova aba.'
        );
      }

      atualizarBadgePendentes(data);
    } catch (e) {
      console.error(e);
      toast('Erro ao atualizar preview: ' + e.message);
    } finally {
      if (loadingEl) loadingEl.classList.remove('show');
    }
  }

  /* =====================================================================
     TOGGLES de campos (ativar/desativar)
     Extraída em função nomeada porque grupos de sócio clonados dinamicamente
     (ver criarGrupoRepExtra) precisam religar o mesmo comportamento nos seus
     próprios botões — o querySelectorAll abaixo só alcança o DOM que já
     existia no carregamento da página.
     ===================================================================== */
  function wireFieldToggle(btn) {
    btn.addEventListener('click', function () {
      var fieldEl = btn.closest('.field');
      var name = fieldEl.dataset.name;
      if (disabledFields.has(name)) {
        disabledFields.delete(name);
        fieldEl.classList.remove('disabled');
        btn.classList.remove('off');
        btn.textContent = '×';
        btn.title = 'Desativar este campo';
      } else {
        disabledFields.add(name);
        fieldEl.classList.add('disabled');
        btn.classList.add('off');
        btn.textContent = '✓';
        btn.title = 'Reativar este campo';
      }
      schedulePreview();
      // Desativar/reativar um nome ou e-mail muda QUEM assina — o botão de
      // assinatura tem que reavaliar (ver signatariosSemEmail).
      atualizarEstadoBtnDocusign();
    });
  }
  document.querySelectorAll('.field-toggle').forEach(wireFieldToggle);

  /* Restaura o estado "desativado" de um conjunto de campos (ao reabrir um
     contrato salvo). Chamar DEPOIS de os grupos de sócio extra existirem no
     DOM — senão os campos deles não recebem o estado visual. */
  function aplicarDisabledFields(lista) {
    disabledFields.clear();
    (lista || []).forEach(function (f) { disabledFields.add(f); });
    document.querySelectorAll('.field').forEach(function (fieldEl) {
      var name = fieldEl.dataset.name;
      var toggle = fieldEl.querySelector('.field-toggle');
      if (!name || !toggle) return;
      if (disabledFields.has(name)) {
        fieldEl.classList.add('disabled');
        toggle.classList.add('off');
        toggle.textContent = '✓';
        toggle.title = 'Reativar este campo';
      } else {
        fieldEl.classList.remove('disabled');
        toggle.classList.remove('off');
        toggle.textContent = '×';
        toggle.title = 'Desativar este campo';
      }
    });
  }

  /* =====================================================================
     "+ Adicionar responsável" — clona o bloco "Representante Legal" (grupo
     data-rep-group="1") pra qualificar mais de um sócio no contrato PJ. Os
     nomes de campo do clone viram REP{N}_* (N = próximo índice livre); a
     coleta de campos (getFieldValues) e o histórico (postMessage) já
     enxergam esses nomes de forma genérica, sem mudança nenhuma. A expansão
     das cláusulas (parágrafo de qualificação + linha de assinatura extra por
     sócio) está em expandirBlocosComSocios, mais acima.
     ===================================================================== */
  var repsExtraContainer = document.getElementById('reps-extra-container');
  var repGroupTemplate = document.querySelector('[data-rep-group="1"]');

  function criarGrupoRepExtra() {
    if (!repGroupTemplate || !repsExtraContainer) return;
    var indicesAtuais = indicesRepExtras();
    var maiorIndice = indicesAtuais.length ? indicesAtuais[indicesAtuais.length - 1] : 1;
    var novoIndice = maiorIndice + 1;

    var clone = repGroupTemplate.cloneNode(true);
    clone.dataset.repGroup = String(novoIndice);

    clone.querySelectorAll('[data-field]').forEach(function (el) {
      el.dataset.field = el.dataset.field.replace(/^REP_/, 'REP' + novoIndice + '_');
      if (el.tagName === 'SELECT') { el.selectedIndex = 0; } else { el.value = el.defaultValue || ''; }
    });
    clone.querySelectorAll('[data-name]').forEach(function (el) {
      el.dataset.name = el.dataset.name.replace(/^REP_/, 'REP' + novoIndice + '_');
    });
    // Nenhum campo clonado nasce desativado, mesmo que o original (grupo 1)
    // tivesse algum campo desativado no momento do clique.
    clone.querySelectorAll('.field').forEach(function (el) { el.classList.remove('disabled'); });
    clone.querySelectorAll('.field-toggle').forEach(function (btn) {
      btn.classList.remove('off');
      btn.textContent = '×';
      btn.title = 'Desativar este campo';
      wireFieldToggle(btn);
    });

    // Título + botão "Remover" (só nos grupos extras — o grupo 1 é sempre obrigatório)
    var titulo = clone.querySelector('h3');
    if (titulo) {
      titulo.textContent = 'Responsável adicional ' + (novoIndice - 1);
      var btnRemover = document.createElement('button');
      btnRemover.type = 'button';
      btnRemover.className = 'btn-remover-socio';
      btnRemover.textContent = '✕ Remover';
      btnRemover.addEventListener('click', function () {
        // Tira os campos deste grupo do Set de desativados ANTES de remover do
        // DOM. Sem isso, o índice é reciclado (remover o grupo 2 e adicionar
        // outro devolve o índice 2) e o grupo NOVO herdaria a desativação do
        // antigo: o campo apareceria ativo na tela, mas o sócio sumiria do PDF
        // e da lista de signatários, sem erro nenhum.
        clone.querySelectorAll('[data-field]').forEach(function (el) {
          disabledFields.delete(el.dataset.field);
        });
        clone.remove();
        schedulePreview();
        atualizarEstadoBtnDocusign();
      });
      titulo.appendChild(btnRemover);
    }

    repsExtraContainer.appendChild(clone);
    schedulePreview();
    atualizarEstadoBtnDocusign();
  }

  var btnAddSocio = document.getElementById('btn-add-socio');
  if (btnAddSocio) btnAddSocio.addEventListener('click', criarGrupoRepExtra);

  // Re-abrir um contrato salvo (histórico local OU "Re-editar" do CRM) só
  // preenche campos que já EXISTEM no DOM — sócios extras (REP2_*, REP3_*...)
  // não existem até alguém clicar "+ Adicionar responsável". Antes de
  // restaurar os valores, recria os grupos extras necessários a partir das
  // chaves presentes em `fields` (limpa e recria do zero pra não duplicar
  // caso o contrato já tenha sido reaberto antes nesta mesma sessão).
  function garantirGruposRepExtrasParaCampos(fields) {
    if (!repsExtraContainer) return;
    repsExtraContainer.innerHTML = '';
    var maiorIndice = 1;
    Object.keys(fields || {}).forEach(function (k) {
      var m = /^REP(\d+)_/.exec(k);
      if (m) { var n = parseInt(m[1], 10); if (n > maiorIndice) maiorIndice = n; }
    });
    for (var i = 1; i < maiorIndice; i++) criarGrupoRepExtra();
  }

  /* =====================================================================
     Form events
     ===================================================================== */
  var formEl = document.getElementById('form-parceiro');
  if (formEl) {
    formEl.addEventListener('input', schedulePreview);
    formEl.addEventListener('input', atualizarEstadoBtnDocusign);
  }

  var btnClear = document.getElementById('btn-clear');
  if (btnClear) {
    btnClear.addEventListener('click', function () {
      if (!confirm('Limpar todos os dados preenchidos?')) return;
      if (formEl) formEl.reset();
      schedulePreview();
    });
  }

  /* =====================================================================
     VALIDAÇÃO — campos ativos visiveis nao podem estar vazios
     ===================================================================== */
  function getCamposObrigatoriosVazios() {
    var vazios = [];
    document.querySelectorAll('[data-field]').forEach(function (input) {
      var name = input.dataset.field;
      var fieldEl = input.closest('.field');
      var visible = input.offsetParent !== null;
      if (!visible) return;                       // campo escondido pelo modo PJ/PF
      if (disabledFields.has(name)) return;       // desativado pelo usuario
      // E-mail (PF_EMAIL/REP_EMAIL/REP{N}_EMAIL) não entra na cláusula do
      // contrato — só habilita o botão "Assinatura eletrônica" (ver
      // atualizarEstadoBtnDocusign). "Exportar PDF" não deve exigi-lo.
      if (/_EMAIL$/.test(name)) return;
      if (!input.value.trim()) {
        var labelNode = fieldEl && fieldEl.querySelector('label');
        var label = (labelNode && labelNode.childNodes[0] && labelNode.childNodes[0].textContent.trim()) || name;
        vazios.push({ name: name, label: label, fieldEl: fieldEl });
      }
    });
    return vazios;
  }

  function destacarCamposFaltantes(vazios) {
    // limpa estado anterior
    document.querySelectorAll('.field.missing').forEach(function (el) { el.classList.remove('missing'); });
    vazios.forEach(function (v) { if (v.fieldEl) v.fieldEl.classList.add('missing'); });
    // remove o destaque depois de 4s
    setTimeout(function () {
      vazios.forEach(function (v) { if (v.fieldEl) v.fieldEl.classList.remove('missing'); });
    }, 4000);
    // rola o primeiro pra view
    if (vazios[0] && vazios[0].fieldEl) {
      vazios[0].fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function validarAntesDeExportar() {
    var vazios = getCamposObrigatoriosVazios();
    if (vazios.length === 0) return true;
    destacarCamposFaltantes(vazios);
    var lista = vazios.slice(0, 5).map(function (v) { return v.label; }).join(', ');
    var sufixo = vazios.length > 5 ? (' e +' + (vazios.length - 5)) : '';
    toast('⚠ Preencha (ou desative com ✕): ' + lista + sufixo);
    return false;
  }

  /* =====================================================================
     EXPORTAR PDF — com validação obrigatória
     ===================================================================== */
  var btnPdf = document.getElementById('btn-pdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', async function () {
      if (!validarAntesDeExportar()) return;
      var data = getFieldValues();
      try {
        await gerarPdfContrato(data, true);
        histAdd();
        toast('✓ PDF exportado e salvo no histórico.');
      } catch (e) {
        console.error(e);
        toast('Erro ao gerar PDF: ' + e.message);
      }
    });
  }

  // Minuta genérica: baixa direto, sem dados do parceiro, sem validar nem
  // registrar no histórico (é só um rascunho para o parceiro revisar).
  var btnMinuta = document.getElementById('btn-minuta');
  if (btnMinuta) {
    btnMinuta.addEventListener('click', async function () {
      try {
        await gerarPdfContrato(getMinutaData(), true, true);
        toast('✓ Minuta gerada (sem dados do parceiro).');
      } catch (e) {
        console.error(e);
        toast('Erro ao gerar minuta: ' + e.message);
      }
    });
  }

  /* =====================================================================
     E-MAIL (mailto basico — fase 2: backend p/ anexar PDF)
     Todo o texto (assunto/corpo) vem de cfg.email — se o tenant não
     declarar esse bloco, os campos ficam em branco mas o botão não quebra.
     ===================================================================== */
  var btnEmail = document.getElementById('btn-email');
  if (btnEmail) {
    btnEmail.addEventListener('click', function () {
      if (!validarAntesDeExportar()) return;
      var data = getFieldValues();
      var emailCfg = cfg.email || {};
      var email = currentMode === 'pf' ? data.PF_EMAIL : data.REP_EMAIL;
      var nomeParceiro = currentMode === 'pf' ? data.PF_NOME : data.PARCEIRO_RAZAO;
      var nomeContato = currentMode === 'pf' ? data.PF_NOME : data.REP_NOME;
      if (!email) {
        toast('Preencha o e-mail do parceiro.');
        return;
      }
      var subject = encodeURIComponent(
        (emailCfg.subjectPrefix || 'Contrato de Parceria') + ' / ' + (nomeParceiro || 'Parceiro')
      );
      var body = encodeURIComponent(
        'Olá ' + (nomeContato || '') + ',\n\n' +
        'Segue, em anexo, o contrato de parceria profissional entre a ' + (emailCfg.companyName || '') +
        ' e ' + (nomeParceiro || '') + '.\n\n' +
        'Por favor, exporte o PDF (botão "Exportar PDF") e anexe-o a este e-mail antes de enviar.\n\n' +
        'Atenciosamente,\n' + (emailCfg.signerName || '') + '\n' + (emailCfg.signerCompany || '') +
        '\n' + (emailCfg.phone || '') + '\n' + (emailCfg.website || '')
      );
      window.location.href = 'mailto:' + email + '?subject=' + subject + '&body=' + body;
    });
  }

  /* =====================================================================
     ASSINATURA ELETRÔNICA (ZapSign) — o botão só habilita quando TODO
     signatário que vai aparecer no documento tem e-mail: no modo PF, o
     cliente (PF_EMAIL); no PJ, o representante legal (REP_EMAIL) e cada
     responsável adicional preenchido (REP2_EMAIL, REP3_EMAIL, ...). Cada um
     recebe o SEU link individual por e-mail, então quem não tem e-mail
     simplesmente não conseguiria assinar.
     Habilitado, o clique gera o PDF (igual "Exportar PDF"), salva no
     histórico E pede pro CRM disparar o envio num passo só. Quem assina é
     derivado no servidor a partir do próprio contrato salvo (ver
     extrairSignatariosDaContraparte em (crm)/contratos/actions.ts) + o
     signatário da empresa configurado no admin — o motor não monta essa
     lista nem fala com a API do ZapSign.
     ===================================================================== */
  var btnDocusign = document.getElementById('btn-docusign');

  // Valor de um campo COMO ELE SAI NO PDF: campo desativado (botão ×) conta
  // como vazio — quem foi desativado não aparece no documento e, portanto, não
  // é signatário. Mesma regra que getFieldValues() aplica pro PDF e que o
  // servidor aplica pra montar a lista de signatários.
  function valorEfetivo(campo) {
    if (disabledFields.has(campo)) return '';
    var el = document.querySelector('[data-field="' + campo + '"]');
    return el ? el.value.trim() : '';
  }

  // Devolve os nomes de quem VAI ASSINAR mas está sem e-mail. Vazio = pode
  // enviar. Espelha a validação do servidor (que é a que vale de fato).
  function signatariosSemEmail() {
    function faltando(campoNome, campoEmail) {
      var nome = valorEfetivo(campoNome);
      if (!nome) return null;                             // não é signatário
      return valorEfetivo(campoEmail) ? null : nome;      // signatário sem e-mail
    }

    if (currentMode === 'pf') {
      // Sem nome não há signatário nenhum — não dá pra enviar.
      if (!valorEfetivo('PF_NOME')) return ['(cliente)'];
      var pf = faltando('PF_NOME', 'PF_EMAIL');
      return pf ? [pf] : [];
    }

    if (!valorEfetivo('REP_NOME')) return ['(representante legal)'];
    var pendentes = [];
    var principal = faltando('REP_NOME', 'REP_EMAIL');
    if (principal) pendentes.push(principal);
    indicesRepExtras().forEach(function (i) {
      var extra = faltando('REP' + i + '_NOME', 'REP' + i + '_EMAIL');
      if (extra) pendentes.push(extra);
    });
    return pendentes;
  }

  function atualizarEstadoBtnDocusign() {
    if (!btnDocusign) return;
    var pendentes = signatariosSemEmail();
    var habilitado = pendentes.length === 0;
    btnDocusign.disabled = !habilitado;
    btnDocusign.classList.toggle('btn-disabled', !habilitado);
    if (habilitado) {
      btnDocusign.removeAttribute('data-badge');
      btnDocusign.title = 'Salva o contrato e envia o link de assinatura por e-mail para cada signatário';
      return;
    }
    // Distingue "contrato ainda sem signatário preenchido" (marcadores entre
    // parênteses, ex.: '(representante legal)') de "signatário preenchido mas
    // sem e-mail" (nome real). A tag do botão é CSS content:attr(data-badge),
    // então precisa refletir o motivo REAL — antes dizia sempre 'FALTA E-MAIL',
    // o que enganava quem só não tinha preenchido os dados ainda.
    var soFaltaPreencher = pendentes.every(function (p) { return p.charAt(0) === '('; });
    btnDocusign.dataset.badge = soFaltaPreencher ? 'PREENCHA' : 'FALTA E-MAIL';
    btnDocusign.title = soFaltaPreencher
      ? 'Preencha os dados do contrato (nome do signatário) para habilitar o envio para assinatura'
      : 'Sem e-mail para: ' + pendentes.join(', ') + ' — cada signatário recebe o link no próprio e-mail.';
  }

  if (btnDocusign) {
    btnDocusign.addEventListener('click', async function () {
      if (btnDocusign.disabled) return;
      if (!validarAntesDeExportar()) return;
      var pendentes = signatariosSemEmail();
      if (pendentes.length > 0) {
        atualizarEstadoBtnDocusign();
        toast('⚠ Sem e-mail para: ' + pendentes.join(', '));
        return;
      }
      try {
        await gerarPdfContrato(getFieldValues(), true);
        histAdd({ autoEnviarAssinatura: true });
        toast('Gerando e enviando para assinatura eletrônica…');
      } catch (e) {
        console.error(e);
        toast('Erro ao gerar PDF: ' + e.message);
      }
    });
  }
  atualizarEstadoBtnDocusign();

  /* =====================================================================
     Toast helper
     ===================================================================== */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3000);
  }

  /* Hint ao vivo do extenso da % comissao */
  function atualizarHintExtenso() {
    var input = document.querySelector('[data-field="COMISSAO_PCT"]');
    var hint = document.getElementById('hint-extenso');
    if (!input || !hint) return;
    var ext = numeroPorExtenso(input.value);
    hint.textContent = ext ? ('(' + ext + ')') : '';
  }
  var comissaoInput = document.querySelector('[data-field="COMISSAO_PCT"]');
  if (comissaoInput) {
    comissaoInput.addEventListener('input', atualizarHintExtenso);
    atualizarHintExtenso();
  }

  /* Nacionalidade acompanha o Sexo (só nos valores padrão; não toca nacionalidade custom) */
  (function syncNacionalidadeSexo() {
    var sexoEl = document.querySelector('[data-field="PF_SEXO"]');
    var nacEl = document.querySelector('[data-field="PF_NACIONALIDADE"]');
    if (!sexoEl || !nacEl) return;
    sexoEl.addEventListener('change', function () {
      var fem = sexoEl.value === 'feminino';
      var atual = nacEl.value.trim().toLowerCase();
      if (fem && atual === 'brasileiro') nacEl.value = 'brasileira';
      else if (!fem && atual === 'brasileira') nacEl.value = 'brasileiro';
      schedulePreview();
    });
  })();

  /* Toggle PJ/PF */
  var btnModoPJ = document.getElementById('btn-modo-pj');
  var btnModoPF = document.getElementById('btn-modo-pf');
  if (btnModoPJ) btnModoPJ.addEventListener('click', function () { setModo('pj'); });
  if (btnModoPF) btnModoPF.addEventListener('click', function () { setModo('pf'); });
  setModo(cfg.defaultMode || 'pj');  // default

  /* =====================================================================
     EDITOR DE CLÁUSULAS (modal)
     ===================================================================== */
  var modal = document.getElementById('modal-clausulas');
  var editorEl = document.getElementById('clausulas-editor');

  function escapeForTextarea(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function abrirEditorClausulas() {
    renderClausulasEditor();
    if (modal) modal.classList.add('show');
  }
  function fecharEditorClausulas() {
    if (modal) modal.classList.remove('show');
  }

  function renderClausulasEditor() {
    if (!editorEl) return;
    editorEl.innerHTML = '';
    CONTRACT_BLOCKS.forEach(function (block, i) {
      var wrap = document.createElement('div');
      wrap.className = 'clausula-item ' + block.type;
      var modeBadge = block.mode ? ('<span class="clausula-badge badge-' + block.mode + '">' + block.mode.toUpperCase() + '</span>') : '';
      var rows = Math.min(10, Math.max(2, Math.ceil(block.text.length / 70)));
      wrap.innerHTML =
        '<div class="clausula-meta">' +
          '<span class="clausula-badge badge-' + block.type + '">' + block.type + '</span>' +
          modeBadge +
          '<span class="clausula-num">#' + (i + 1) + '</span>' +
        '</div>' +
        '<textarea data-idx="' + i + '" rows="' + rows + '">' + escapeForTextarea(block.text) + '</textarea>';
      editorEl.appendChild(wrap);
    });
  }

  function salvarClausulas() {
    var novos = CONTRACT_BLOCKS.map(function (b, i) {
      var ta = editorEl.querySelector('textarea[data-idx="' + i + '"]');
      return ta ? Object.assign({}, b, { text: ta.value }) : Object.assign({}, b);
    });
    CONTRACT_BLOCKS = novos;
    persistClauses();
    fecharEditorClausulas();
    schedulePreview();
    toast('Cláusulas salvas ✓');
  }

  function restaurarClausulasPadrao() {
    var brand = cfg.brandName ? (' da ' + cfg.brandName) : '';
    if (!confirm('Restaurar TODAS as cláusulas para o texto padrão' + brand + '? Suas edições serão perdidas.')) return;
    var m = modeloAtual();
    try { localStorage.removeItem(m.storageKey); } catch (e) {}
    CONTRACT_BLOCKS = JSON.parse(JSON.stringify(m.blocks));
    renderClausulasEditor();
    schedulePreview();
    toast('Padrão restaurado ✓');
  }

  function exportarClausulasJSON() {
    var blob = new Blob([JSON.stringify(CONTRACT_BLOCKS, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (cfg.clausulasFilePrefix || 'contrato') + '_clausulas_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function importarClausulasJSON(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error('formato inválido');
        // valida estrutura básica
        if (!parsed.every(function (b) { return b && typeof b.text === 'string' && typeof b.type === 'string'; })) {
          throw new Error('estrutura inválida');
        }
        CONTRACT_BLOCKS = parsed;
        persistClauses();
        renderClausulasEditor();
        schedulePreview();
        toast(parsed.length + ' cláusulas importadas ✓');
      } catch (e) {
        toast('Arquivo JSON inválido: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  /* Listeners do modal */
  var btnEditarClausulas = document.getElementById('btn-editar-clausulas');
  var modalClose = document.getElementById('modal-close');
  var btnCancelClausulas = document.getElementById('btn-cancel-clausulas');
  var btnSaveClausulas = document.getElementById('btn-save-clausulas');
  var btnRestoreClausulas = document.getElementById('btn-restore-clausulas');
  var btnExportClausulas = document.getElementById('btn-export-clausulas');
  var btnImportClausulas = document.getElementById('btn-import-clausulas');
  var importInput = document.getElementById('import-input');

  if (btnEditarClausulas) btnEditarClausulas.addEventListener('click', abrirEditorClausulas);
  if (modalClose) modalClose.addEventListener('click', fecharEditorClausulas);
  if (btnCancelClausulas) btnCancelClausulas.addEventListener('click', fecharEditorClausulas);
  if (btnSaveClausulas) btnSaveClausulas.addEventListener('click', salvarClausulas);
  if (btnRestoreClausulas) btnRestoreClausulas.addEventListener('click', restaurarClausulasPadrao);
  if (btnExportClausulas) btnExportClausulas.addEventListener('click', exportarClausulasJSON);
  if (btnImportClausulas && importInput) {
    btnImportClausulas.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function (e) {
      if (e.target.files[0]) importarClausulasJSON(e.target.files[0]);
      e.target.value = '';
    });
  }
  // ESC fecha o modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('show')) fecharEditorClausulas();
  });
  // Clicar fora do card fecha
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) fecharEditorClausulas();
    });
  }

  /* Tabs de tipos de contrato — preparado pra novos contratos no futuro */
  document.querySelectorAll('.contract-tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (tab.classList.contains('coming-soon')) {
        toast('Esse contrato ainda não foi cadastrado.');
        return;
      }
      var alvo = tab.dataset.contract;
      if (!CONTRACT_MODELS[alvo] || alvo === currentContract) return;
      document.querySelectorAll('.contract-tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentContract = alvo;
      CONTRACT_BLOCKS = loadClauses();
      if (modal && modal.classList.contains('show')) renderClausulasEditor();
      schedulePreview();
    });
  });

  /* Inicializa preview */
  setTimeout(updatePreview, 100);

  /* =====================================================================
     HISTÓRICO DE CONTRATOS — localStorage completo com restauração total
     A chave de storage vem de cfg.historyKey (cada tenant tem a sua, pra
     não misturar histórico entre marcas diferentes). A Aurum usa a mesma
     chave de sempre ('aurum_contratos_hist_v2') pra não perder o histórico
     já salvo nos navegadores da equipe.
     ===================================================================== */
  var HIST_KEY = cfg.historyKey || 'contrato_hist_v2';
  var HIST_MAX = 100;

  function histLoad() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function histSave(list) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list)); }
    catch (e) { toast('Histórico: erro ao salvar — localStorage cheio?'); }
  }

  function histAdd(opts) {
    opts = opts || {};
    var rawFields = {};
    document.querySelectorAll('[data-field]').forEach(function (inp) {
      rawFields[inp.dataset.field] = inp.value;
    });
    var nomeParceiro = currentMode === 'pf'
      ? (rawFields.PF_NOME || '–')
      : (rawFields.PARCEIRO_RAZAO || '–');
    var entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      ts: new Date().toISOString(),
      mode: currentMode,
      fields: rawFields,
      disabledFields: [...disabledFields],
      nomeParceiro: nomeParceiro.slice(0, 80),
      comissao: rawFields.COMISSAO_PCT || ''
    };
    var list = histLoad();
    list.unshift(entry);
    if (list.length > HIST_MAX) list.length = HIST_MAX;
    histSave(list);
    histRender();
    // postMessage para o CRM parent — 'aurum_contrato_gerado' é o nome
    // HISTÓRICO do protocolo, mas é genérico: TODO template usa esse mesmo
    // tipo de evento, não renomear (ver comentário no topo do arquivo).
    // `disabled` vai junto de propósito: o servidor usa a MESMA regra do PDF pra
    // saber quem assina (ver extrairSignatariosDaContraparte em
    // (crm)/contratos/actions.ts). Sem isso, alguém cujo campo foi DESATIVADO
    // (botão ×) some do documento mas continuaria em `fields` com nome/e-mail
    // — e receberia um link real de assinatura de um contrato onde não aparece.
    var payload = { type: 'aurum_contrato_gerado', entry: { nome: entry.nomeParceiro, tipo: entry.mode.toUpperCase(), data: entry.ts }, parceiro: { mode: currentMode, fields: rawFields, disabled: [...disabledFields] }, pdfBase64: lastPdfBase64, pdfFileName: lastPdfFileName };
    // Botão "Assinatura eletrônica" (ver atualizarEstadoBtnDocusign): pede
    // pro CRM, além de salvar, já disparar o envio pra assinatura. Não manda
    // signatário: o servidor deriva a lista dos próprios campos do contrato
    // (que vão em `parceiro.fields` acima) + o signatário da empresa — assim
    // quem assina no ZapSign é exatamente quem está nas linhas de assinatura
    // do PDF, sem chance de divergir.
    if (opts.autoEnviarAssinatura) payload.autoEnviarAssinatura = true;
    try { window.parent.postMessage(payload, '*'); } catch (e) {}
  }

  function histDelete(id) {
    if (!confirm('Remover este contrato do histórico?')) return;
    histSave(histLoad().filter(function (e) { return e.id !== id; }));
    histRender();
  }

  function histClearAll() {
    if (!confirm('Limpar todo o histórico?\nEsta ação não pode ser desfeita.')) return;
    histSave([]);
    histRender();
  }

  function histOpen(id) {
    var entry = histLoad().find(function (e) { return e.id === id; });
    if (!entry) { toast('Contrato não encontrado no histórico.'); return; }

    // 1. Modo PJ/PF
    setModo(entry.mode);

    // 2. Valores dos campos (garante os grupos de sócio extra ANTES de
    //    restaurar valores — ver garantirGruposRepExtrasParaCampos)
    garantirGruposRepExtrasParaCampos(entry.fields);
    document.querySelectorAll('[data-field]').forEach(function (input) {
      var name = input.dataset.field;
      if (entry.fields && name in entry.fields) input.value = entry.fields[name];
    });

    // 3. Campos desativados — DEPOIS de criar os grupos extras, senão os campos
    //    deles (REP2_*, ...) ainda não existem no DOM e ficariam visualmente
    //    ativos mesmo estando desativados na lógica.
    aplicarDisabledFields(entry.disabledFields || []);

    atualizarHintExtenso();
    histClose();
    schedulePreview();
    atualizarEstadoBtnDocusign();
    toast('✓ Contrato carregado — edite e exporte novamente se necessário.');
  }

  // ── Integração CRM Studio: RE-EDITAR ──────────────────────────────────────
  // O CRM (parent) envia { type:'contrato_carregar', dados:{ mode, fields } } de um
  // contrato salvo no histórico do banco → preenche o form p/ editar e gerar de novo.
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.type !== 'contrato_carregar' || !d.dados) return;
    var fields = d.dados.fields || {};
    try { setModo(d.dados.mode || 'pj'); } catch (e) {}
    try { garantirGruposRepExtrasParaCampos(fields); } catch (e) {}
    document.querySelectorAll('[data-field]').forEach(function (input) {
      var name = input.dataset.field;
      if (name in fields) input.value = fields[name];
    });
    // Restaura quais campos estavam DESATIVADOS (botão ×) — sem isso, reabrir
    // um contrato "ressuscitaria" no PDF (e na lista de signatários) alguém que
    // tinha sido deliberadamente tirado dele.
    try { aplicarDisabledFields(d.dados.disabled || []); } catch (e) {}
    try { atualizarHintExtenso(); } catch (e) {}
    try { schedulePreview(); } catch (e) {}
    try { atualizarEstadoBtnDocusign(); } catch (e) {}
    try { toast('✓ Contrato carregado — edite e exporte novamente.'); } catch (e) {}
  });

  function histFormatDate(iso) {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  }

  function histRender() {
    var list = histLoad();
    var container = document.getElementById('history-content');
    var footer = document.getElementById('history-footer');
    if (!container) return;
    if (!list.length) {
      if (footer) footer.style.display = 'none';
      container.innerHTML = '<div class="history-empty">' +
        '<div class="hist-icon">📄</div>' +
        '<p>Nenhum contrato gerado ainda.<br>' +
        'Preencha os dados e clique em <strong>"Exportar PDF"</strong><br>' +
        'para salvar automaticamente aqui.</p>' +
        '</div>';
      return;
    }
    if (footer) footer.style.display = 'block';
    container.innerHTML = '<div class="history-list">' + list.map(function (e) {
      return '<div class="history-entry">' +
          '<div class="hist-entry-top">' +
            '<span class="hist-mode-badge">' + (e.mode || 'pj').toUpperCase() + '</span>' +
            '<div class="hist-entry-name" title="' + (e.nomeParceiro || '').replace(/"/g, '&quot;') + '">' + (e.nomeParceiro || '(sem nome)') + '</div>' +
          '</div>' +
          '<div class="hist-entry-meta">' +
            '<span>🗓 ' + histFormatDate(e.ts) + '</span>' +
            (e.comissao ? ('<span>💰 ' + e.comissao + '%</span>') : '') +
          '</div>' +
          '<div class="hist-entry-actions">' +
            '<button class="btn-hist-load" onclick="histOpen(\'' + e.id + '\')">↩ Abrir e editar</button>' +
            '<button class="btn-hist-del" onclick="histDelete(\'' + e.id + '\')">Excluir</button>' +
          '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function histToggle() {
    var drawer = document.getElementById('history-drawer');
    var overlay = document.getElementById('history-overlay');
    if (!drawer) return;
    if (drawer.classList.contains('open')) { histClose(); }
    else { histRender(); drawer.classList.add('open'); if (overlay) overlay.classList.add('show'); }
  }
  function histClose() {
    var drawer = document.getElementById('history-drawer');
    var overlay = document.getElementById('history-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }

  var btnHistory = document.getElementById('btn-history');
  var btnHistClose = document.getElementById('btn-hist-close');
  var historyOverlay = document.getElementById('history-overlay');
  var btnHistClearAll = document.getElementById('btn-hist-clear-all');
  if (btnHistory) btnHistory.addEventListener('click', histToggle);
  if (btnHistClose) btnHistClose.addEventListener('click', histClose);
  if (historyOverlay) historyOverlay.addEventListener('click', histClose);
  if (btnHistClearAll) btnHistClearAll.addEventListener('click', histClearAll);

  // histOpen/histDelete são chamados via atributo onclick="" inline gerado em
  // histRender() (string HTML), então precisam estar no escopo global.
  window.histOpen = histOpen;
  window.histDelete = histDelete;
})();
