'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Camera, Send, Loader2, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BugReportButtonProps {
  collapsed?: boolean
  empresaId?: string | null
  empresaNome?: string | null
  userName?: string | null
  userRole?: string | null
}

type Step = 'idle' | 'capturing' | 'form' | 'sending' | 'done'

export function BugReportButton({
  collapsed,
  empresaId,
  empresaNome,
  userName,
  userRole,
}: BugReportButtonProps) {
  const [step, setStep]           = useState<Step>('idle')
  const [descricao, setDescricao] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const textareaRef               = useRef<HTMLTextAreaElement>(null)

  async function captureAndOpen() {
    setStep('capturing')
    let shot: string | null = null
    try {
      // html2canvas-pro (não o html2canvas original): o original não entende
      // oklch(), a função de cor que o Tailwind v4 usa por padrão — todo
      // screenshot falhava silenciosamente (catch abaixo) e caía pro texto
      // sem imagem.
      const html2canvas = (await import('html2canvas-pro')).default
      const canvas = await html2canvas(document.body, {
        scale: 0.75,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.id === 'bug-report-overlay',
      })
      shot = canvas.toDataURL('image/png')
    } catch {
      // continua sem screenshot
    }
    setScreenshot(shot)
    setStep('form')
    setTimeout(() => textareaRef.current?.focus(), 60)
  }

  async function handleSubmit() {
    if (!descricao.trim()) {
      toast.error('Descreva o problema antes de enviar.')
      return
    }
    setStep('sending')
    try {
      const res = await fetch('/api/bug-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          descricao,
          screenshot_base64: screenshot,
          contexto: {
            url:           window.location.href,
            titulo_pagina: document.title,
            user_agent:    navigator.userAgent,
            viewport:      `${window.innerWidth}x${window.innerHeight}`,
            empresa_nome:  empresaNome ?? null,
          },
        }),
      })
      if (!res.ok) throw new Error()
      setStep('done')
    } catch {
      toast.error('Falha ao enviar. Tente novamente.')
      setStep('form')
    }
  }

  function handleClose() {
    if (step === 'sending') return
    setStep('idle'); setDescricao(''); setScreenshot(null)
  }

  const isOpen = step === 'form' || step === 'sending' || step === 'done'

  return (
    <>
      {/* Botão na sidebar */}
      <button
        type="button"
        onClick={captureAndOpen}
        disabled={step === 'capturing'}
        title="Teve um problema?"
        className={cn(
          'group mt-auto flex w-full items-center rounded-lg text-sm font-medium transition-colors duration-200',
          'text-red-400/70 hover:bg-red-500/10 hover:text-red-400',
          collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          step === 'capturing' && 'cursor-wait opacity-60'
        )}
      >
        {step === 'capturing'
          ? <Loader2 className="size-4 shrink-0 animate-spin text-sidebar-foreground/50" />
          : <AlertTriangle className="size-4 shrink-0 text-red-400/60 transition-colors group-hover:text-red-400" />
        }
        {!collapsed && (
          <span>{step === 'capturing' ? 'Capturando tela…' : 'Teve um problema?'}</span>
        )}
      </button>

      {/* Página cheia — via portal pro body: a sidebar usa translate-x-* pro
          off-canvas mobile, e qualquer ancestral com transform vira o
          containing block de filhos "fixed" (spec CSS), prendendo esse
          overlay dentro da caixa da sidebar em vez de cobrir a tela toda. */}
      {isOpen && createPortal(
        <div
          id="bug-report-overlay"
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          {/* Barra superior */}
          <div className="flex items-center gap-3 border-b border-border px-6 py-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950">
              <AlertTriangle className="size-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold leading-none">Reportar problema</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Descreva o que aconteceu — vamos analisar e corrigir.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={step === 'sending'}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>

          {step === 'done' ? (
            /* ── Sucesso ── */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <CheckCircle2 className="size-16 text-green-500" />
              <div>
                <p className="text-xl font-bold">Recebemos! Obrigado.</p>
                <p className="mt-1 text-muted-foreground">
                  Nosso time vai analisar e resolver o mais rápido possível.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Fechar
              </button>
            </div>
          ) : (
            /* ── Formulário ── */
            <div className="flex flex-1 overflow-hidden">

              {/* Coluna esquerda — formulário */}
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-8">

                {/* Descrição */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">O que aconteceu?</label>
                  <textarea
                    ref={textareaRef}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Ao clicar em 'Salvar' no processo, a página ficou em branco e os dados não salvaram…"
                    rows={8}
                    disabled={step === 'sending'}
                    className="w-full resize-none rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60"
                  />
                  <p className="text-right text-[11px] text-muted-foreground">{descricao.length}/1000</p>
                </div>

                {/* Contexto */}
                <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs">
                  <p className="mb-2 font-semibold text-foreground/70">Contexto capturado automaticamente</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <span className="font-medium text-foreground/60">Página</span>
                    <span className="truncate font-mono">{typeof window !== 'undefined' ? window.location.pathname : ''}</span>
                    <span className="font-medium text-foreground/60">Usuário</span>
                    <span>{userName ?? '—'} · {userRole ?? '—'}</span>
                    <span className="font-medium text-foreground/60">Empresa</span>
                    <span>{empresaNome ?? 'plataforma'}</span>
                    <span className="font-medium text-foreground/60">Tela</span>
                    <span>{typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '—'}</span>
                  </div>
                </div>

                {!screenshot && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <Camera className="size-3.5 shrink-0" />
                    Screenshot não disponível — será enviado apenas o texto.
                  </div>
                )}

                {/* Botões */}
                <div className="mt-auto flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={step === 'sending'}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={step === 'sending' || !descricao.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {step === 'sending'
                      ? <><Loader2 className="size-4 animate-spin" /> Enviando…</>
                      : <><Send className="size-4" /> Enviar relatório</>
                    }
                  </button>
                </div>
              </div>

              {/* Coluna direita — screenshot (só em telas grandes) */}
              {screenshot && (
                <div className="hidden w-[45%] shrink-0 flex-col border-l border-border lg:flex">
                  <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
                    <Camera className="size-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Screenshot da tela</span>
                    <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
                      ✓ Capturado
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto bg-secondary/20 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot}
                      alt="Screenshot da tela atual"
                      className="w-full rounded-lg border border-border object-top shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
