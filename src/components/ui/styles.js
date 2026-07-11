const buttonVariants = {
  primary: "ts-button ts-button--primary",
  secondary: "ts-button ts-button--secondary",
  ghost: "ts-button ts-button--ghost",
  danger: "ts-button ts-button--danger",
};

export const buttonClass = (variant = "secondary") => buttonVariants[variant] || buttonVariants.secondary;
export const inputClass = "ts-control";
export const compactInputClass = "ts-control ts-control--compact";
export const cardClass = "ts-card";
export const cardHeaderClass = "ts-card__header";
export const cardBodyClass = "ts-card__body";
