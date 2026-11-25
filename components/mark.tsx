export default function Mark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 520 600" fill="none" aria-hidden="true">
    <defs><linearGradient id="teenman-outline" x1="260" y1="30" x2="260" y2="570" gradientUnits="userSpaceOnUse"><stop stopColor="#242424"/><stop offset=".53" stopColor="#a1a1a1"/><stop offset="1" stopColor="#303030"/></linearGradient></defs>
    <path d="M36 54H484L450 164H321V546H199V164H70L36 54Z" stroke="url(#teenman-outline)" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M88 86H441L427 132H289V514H231V132H102L88 86Z" stroke="url(#teenman-outline)" strokeWidth="3" strokeLinejoin="round"/>
  </svg>;
}
