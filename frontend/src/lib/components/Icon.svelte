<script lang="ts">
  import Search from '@lucide/svelte/icons/search'
  import House from '@lucide/svelte/icons/house'
  import CalendarDays from '@lucide/svelte/icons/calendar-days'
  import Calendar from '@lucide/svelte/icons/calendar'
  import CalendarCheck from '@lucide/svelte/icons/calendar-check'
  import CircleAlert from '@lucide/svelte/icons/circle-alert'
  import User from '@lucide/svelte/icons/user'
  import Settings from '@lucide/svelte/icons/settings'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  import Bell from '@lucide/svelte/icons/bell'
  import BellOff from '@lucide/svelte/icons/bell-off'
  import BellDot from '@lucide/svelte/icons/bell-dot'
  import LogOut from '@lucide/svelte/icons/log-out'
  import Check from '@lucide/svelte/icons/check'
  import X from '@lucide/svelte/icons/x'
  import Info from '@lucide/svelte/icons/info'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import CircleX from '@lucide/svelte/icons/circle-x'
  import Building2 from '@lucide/svelte/icons/building-2'
  import MapPin from '@lucide/svelte/icons/map-pin'
  import Clock from '@lucide/svelte/icons/clock'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronUp from '@lucide/svelte/icons/chevron-up'
  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'
  import SkipForward from '@lucide/svelte/icons/skip-forward'
  import Trophy from '@lucide/svelte/icons/trophy'
  import Users from '@lucide/svelte/icons/users'
  import Mail from '@lucide/svelte/icons/mail'
  import IdCard from '@lucide/svelte/icons/id-card'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Lock from '@lucide/svelte/icons/lock'
  import Menu from '@lucide/svelte/icons/menu'
  import Camera from '@lucide/svelte/icons/camera'
  import Eye from '@lucide/svelte/icons/eye'
  import EyeOff from '@lucide/svelte/icons/eye-off'
  import Image from '@lucide/svelte/icons/image'
  import Upload from '@lucide/svelte/icons/upload'
  import Funnel from '@lucide/svelte/icons/funnel'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import Shield from '@lucide/svelte/icons/shield'
  import ToggleRight from '@lucide/svelte/icons/toggle-right'
  import MessageCircle from '@lucide/svelte/icons/message-circle'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Plus from '@lucide/svelte/icons/plus'
  import Minus from '@lucide/svelte/icons/minus'
  import Send from '@lucide/svelte/icons/send'
  import CircleCheck from '@lucide/svelte/icons/circle-check'
  import CircleHelp from '@lucide/svelte/icons/circle-help'
  import Copy from '@lucide/svelte/icons/copy'
  import Download from '@lucide/svelte/icons/download'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import Map from '@lucide/svelte/icons/map'
  import Phone from '@lucide/svelte/icons/phone'
  import Globe from '@lucide/svelte/icons/globe'
  import Play from '@lucide/svelte/icons/play'
  import Pause from '@lucide/svelte/icons/pause'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import UserCheck from '@lucide/svelte/icons/user-check'
  import UserX from '@lucide/svelte/icons/user-x'
  import CirclePlus from '@lucide/svelte/icons/circle-plus'
  import CircleMinus from '@lucide/svelte/icons/circle-minus'
  import Save from '@lucide/svelte/icons/save'

  export let name: string
  export let size = 20
  export let strokeWidth = 1.8
  export let className = ''

  const icons: Record<string, any> = {
    search: Search,
    home: House,
    house: House,
    'calendar-days': CalendarDays,
    calendar: Calendar,
    'calendar-check': CalendarCheck,
    'alert-circle': CircleAlert,
    'circle-alert': CircleAlert,
    user: User,
    settings: Settings,
    sun: Sun,
    moon: Moon,
    bell: Bell,
    'bell-off': BellOff,
    'bell-dot': BellDot,
    'log-out': LogOut,
    check: Check,
    x: X,
    info: Info,
    'alert-triangle': TriangleAlert,
    'triangle-alert': TriangleAlert,
    'x-circle': CircleX,
    'circle-x': CircleX,
    'building-2': Building2,
    'map-pin': MapPin,
    clock: Clock,
    'chevron-right': ChevronRight,
    'chevron-left': ChevronLeft,
    'chevron-down': ChevronDown,
    'chevron-up': ChevronUp,
    'arrow-right': ArrowRight,
    'arrow-left': ArrowLeft,
    'arrow-up-right': ArrowUpRight,
    'skip-forward': SkipForward,
    trophy: Trophy,
    users: Users,
    mail: Mail,
    'id-card': IdCard,
    pencil: Pencil,
    edit: Pencil,
    lock: Lock,
    menu: Menu,
    camera: Camera,
    eye: Eye,
    'eye-off': EyeOff,
    image: Image,
    upload: Upload,
    filter: Funnel,
    funnel: Funnel,
    'trash-2': Trash2,
    shield: Shield,
    'toggle-right': ToggleRight,
    'message-circle': MessageCircle,
    'refresh-cw': RefreshCw,
    plus: Plus,
    minus: Minus,
    send: Send,
    'circle-check': CircleCheck,
    'check-circle': CircleCheck,
    'circle-help': CircleHelp,
    'help-circle': CircleHelp,
    copy: Copy,
    download: Download,
    'external-link': ExternalLink,
    map: Map,
    phone: Phone,
    globe: Globe,
    play: Play,
    pause: Pause,
    ellipsis: Ellipsis,
    'more-horizontal': Ellipsis,
    'user-check': UserCheck,
    'user-x': UserX,
    'circle-plus': CirclePlus,
    'circle-minus': CircleMinus,
    save: Save
  }

  $: IconComponent = icons[name] || CircleHelp
</script>

<svelte:component
  this={IconComponent}
  {size}
  strokeWidth={strokeWidth}
  class={className}
  aria-hidden="true"
/>
