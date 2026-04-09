import React from 'react';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="field">
      <div className="field__topline">
        <span className="field__label">{label}</span>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function TextInput(props: InputProps) {
  return <input className="input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}
