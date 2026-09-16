/**
 * Quem é o dono do site, para efeito legal.
 *
 * A LGPD exige que o titular saiba quem controla os dados dele e por onde
 * falar com o encarregado. O Decreto 7.962/2013, que trata de comércio
 * eletrônico, pede a identificação do fornecedor de forma destacada. Nada
 * disso estava no ar: a política de privacidade anunciava, em texto
 * visível ao leitor, que o canal de contato "ainda não foi configurado".
 *
 * Fica em variáveis de ambiente, e não no código, porque é dado cadastral
 * que muda sem deploy — e porque deixar o CNPJ no repositório público não
 * acrescenta nada.
 */

export type Controlador = {
  razaoSocial: string | null;
  cnpj: string | null;
  endereco: string | null;
  emailPrivacidade: string | null;
};

export function controlador(): Controlador {
  const limpo = (valor: string | undefined) => {
    const texto = valor?.trim();
    return texto ? texto : null;
  };

  return {
    razaoSocial: limpo(process.env.NEXT_PUBLIC_RAZAO_SOCIAL),
    cnpj: limpo(process.env.NEXT_PUBLIC_CNPJ),
    endereco: limpo(process.env.NEXT_PUBLIC_ENDERECO),
    emailPrivacidade: limpo(process.env.NEXT_PUBLIC_EMAIL_PRIVACIDADE),
  };
}

/** Se o site já pode ser divulgado sem pendência de identificação. */
export function identificacaoCompleta(c = controlador()): boolean {
  return Boolean(c.razaoSocial && c.cnpj && c.emailPrivacidade);
}

/**
 * Avisa no build quando falta identificação.
 *
 * O aviso é para quem publica, não para quem visita: a versão anterior
 * resolvia a ausência escrevendo na própria página que o canal não estava
 * configurado — o leitor descobria a falha antes do dono.
 */
export function avisarSeIncompleto(): void {
  if (process.env.NODE_ENV === "production" && !identificacaoCompleta()) {
    console.warn(
      "[legal] Falta identificação do controlador. Defina NEXT_PUBLIC_RAZAO_SOCIAL, " +
        "NEXT_PUBLIC_CNPJ e NEXT_PUBLIC_EMAIL_PRIVACIDADE antes de divulgar o site."
    );
  }
}
