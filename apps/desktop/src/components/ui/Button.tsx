import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
};

export function Button({ variant = 'primary', block = false, className = '', ...props }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, block ? 'btn--block' : '', className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}
