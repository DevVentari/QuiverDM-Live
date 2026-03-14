import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-amber-500/[0.12] text-amber-400 border border-amber-500/40 shadow-[inset_0_1px_0_hsl(35_80%_70%/0.08)] hover:bg-amber-500/[0.2] hover:border-amber-400/60 hover:text-amber-300 hover:shadow-[0_0_18px_hsl(35_80%_48%/0.18),inset_0_1px_0_hsl(35_80%_70%/0.1)]",
        destructive:
          "bg-red-500/[0.1] text-red-400 border border-red-500/35 hover:bg-red-500/[0.18] hover:border-red-400/55 hover:shadow-[0_0_14px_hsl(0_70%_50%/0.15)]",
        outline:
          "border border-white/[0.08] bg-transparent text-muted-foreground hover:border-white/[0.15] hover:text-foreground hover:bg-white/[0.04]",
        secondary:
          "bg-white/[0.05] text-foreground/70 border border-white/[0.07] hover:bg-white/[0.08] hover:text-foreground",
        ghost: "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
        link: "text-amber-400/80 underline-offset-4 hover:underline hover:text-amber-400",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
