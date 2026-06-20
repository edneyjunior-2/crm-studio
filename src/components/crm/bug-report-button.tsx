'use client'

import { useState, useRef } from 'react'
import { AlertTriangle, Camera, Send, Loader2, CheckCircle2 } from 'lucide-react'
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
  const [step, setStep] = useState<Step>('idle')
  const [descricao, setDescricao] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function captureAndOpen() {
    setStep('capturing')
    let shot: string | null = null

    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        scale: 0.75,          // reduz tamanho do arquivo ~50%
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.id === 'bug-report-overlay',
      })
      shot = canvas.toDataURL('image/png')
    } catch {
      // Screenshot falhou — continua sem ela
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          screenshot_base64: screenshot,
          contexto: {
            url:           window.location.href,
            titulo_pagina: document.title,
            user_agent:    navigator.userAgent,
            viewport:      `${window.innerWidth}x${window.innerHeight}`,
            empresa_id:    empresaId ?? null,
            empresa_nome:  empresaNome ?? null,
            user_name:     userName ?? null,
            user_role:     userRole ?? null,
          },
        }),
      })

      if (!res.ok) throw new Error()
      setStep('done')
      setTimeout(() => {
        setStep('idle')
        setDescricao('')
        setScreenshot(null)
      }, 3000)
    } catch {
      toast.error('Falha ao enviar. Tente novamente.')
      setStep('form')
    }
  }

  function handleClose() {
    setStep('idle')
    setDescricao('')
    setScreenshot(null)
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
          'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
          collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          step === 'capturing' && 'opacity-60 cursor-wait'
        )}
      >
        {step === 'capturing'
          ? <Loader2 className="size-4 shrink-0 animate-spin text-sidebar-foreground/50" />
          : <AlertTriangle className="size-4 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70 transition-colors" />
        }
        {!collapsed && (
          <span className="relative">
            {step === 'capturing' ? 'Capturando tela…' : 'Teve um problema?'}
          </span>
        )}
      </button>

      {/* Overlay/Dialog */}
      {isOpen && (
        <div
          id="bug-report-overlay"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950">
                <AlertTriangle className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold leading-none">Reportar problema</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Descreva o que aconteceu — vamos analisar e corrigir.
                </p>
              </div>
            </div>

            {step === 'done' ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <CheckCircle2 className="size-12 text-green-500" />
                <p className="font-semibold">Recebemos! Obrigado.</p>
                <p className="text-sm text-muted-foreground">
                  Nosso time vai analisar e resolver o mais rápido possível.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-5">
                {/* Screenshot preview */}
                {screenshot && (
                  <div className="group relative overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot}
                      alt="Screenshot da tela"
                      className="h-32 w-full object-cover object-top"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 transition-colors group-hover:bg-black/20">
                      <Camera className="size-4 text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100" />
                      <span className="text-xs font-medium text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100">
                        Screenshot capturado
                      </span>
                    </div>
                    <div className="absolute bottom-1.5 right-1.5 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      ✓ Tela capturada
                    </div>
                  </div>
                )}

                {!screenshot && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <Camera className="size-3.5 shrink-0" />
                    Screenshot não disponível — será enviado apenas o texto.
                  </div>
                )}

                {/* Descrição */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    O que aconteceu?
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Ao clicar em 'Salvar' no processo, a página ficou em branco e os dados não salvaram…"
                    rows={4}
                    disabled={step === 'sending'}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
                  />
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    {descricao.length}/1000
                  </p>
                </div>

                {/* Contexto (informativo) */}
                <div className="rounded-lg bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground/70">Contexto capturado automaticamente:</p>
                  <p className="mt-0.5 truncate font-mono">{typeof window !== 'undefined' ? window.location.pathname : ''}</p>
                  <p className="mt-0.5">{userName} · {userRole} · {empresaNome ?? 'plataforma'}</p>
                </div>

                {/* Ações */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={step === 'sending'}
                    className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={step === 'sending' || !descricao.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {step === 'sending' ? (
                      <><Loader2 className="size-4 animate-spin" /> Enviando…</>
                    ) : (
                      <><Send className="size-4" /> Enviar</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
