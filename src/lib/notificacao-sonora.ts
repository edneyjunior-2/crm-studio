'use client'

/**
 * Bipe curto de notificação (Web Audio API — sem arquivo de áudio, sem
 * dependência nova). Navegador bloqueia áudio antes de qualquer interação do
 * usuário na página, por isso só toca depois que `armarNotificacaoSonora()`
 * foi chamada ao menos uma vez nesta sessão (ver uso em Sidebar).
 */
let armado = false
let ctxCompartilhado: AudioContext | null = null

/** Reusa um único AudioContext pela sessão em vez de criar um novo por bipe
 *  (SPA fica aberta por horas — dezenas de notificações não devem acumular
 *  contextos de áudio). `resume()` porque o contexto pode nascer 'suspended'
 *  até a interação do usuário que já disparou este "armar". */
function obterContexto(): AudioContext | null {
  const AudioContextCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!ctxCompartilhado) ctxCompartilhado = new AudioContextCtor()
  if (ctxCompartilhado.state === 'suspended') ctxCompartilhado.resume().catch(() => {})
  return ctxCompartilhado
}

export function armarNotificacaoSonora() {
  armado = true
  obterContexto()
}

export function tocarSomNotificacao() {
  if (!armado) return
  try {
    const ctx = obterContexto()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Best-effort — nunca quebra a UI por causa de um som.
  }
}
