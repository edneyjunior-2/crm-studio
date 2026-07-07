import { Ga } from '@/components/analytics/ga'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Ga />
      {children}
    </>
  )
}
