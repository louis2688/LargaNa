import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("ui-button", {
  variants: {
    variant: {
      default: "ui-button--default",
      secondary: "ui-button--secondary",
      outline: "ui-button--outline",
      ghost: "ui-button--ghost",
      link: "ui-button--link"
    },
    size: {
      default: "ui-button--default-size",
      sm: "ui-button--sm",
      icon: "ui-button--icon"
    }
  },
  defaultVariants: { variant: "default", size: "default" }
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} type={type} {...props} />
));
Button.displayName = "Button";

export { Button, buttonVariants };
