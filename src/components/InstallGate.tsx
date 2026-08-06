import React from 'react';
import InstallScreen from '../screens/InstallScreen';
import { usePwaInstall } from '../services/pwaInstall';

/**
 * Decide se a tela de instalação aparece no arranque.
 *
 * Aparece quando: está na web, ainda não foi instalado e o voluntário não
 * dispensou nos últimos dias. Some sozinha assim que a instalação acontece
 * (evento `appinstalled`, capturado no index.html).
 *
 * Fica por cima de tudo, inclusive do login — a instalação não depende de
 * estar autenticado, e é justamente na primeira visita que ela importa.
 */
export default function InstallGate() {
  const {
    naWeb,
    instalado,
    pronto,
    deveMostrar,
    navegador,
    promptDisponivel,
    instalar,
    dispensarAgora,
  } = usePwaInstall();

  if (!naWeb || !pronto || instalado || !deveMostrar) return null;

  return (
    <InstallScreen
      navegador={navegador}
      promptDisponivel={promptDisponivel}
      onInstalar={instalar}
      onDispensar={dispensarAgora}
    />
  );
}
