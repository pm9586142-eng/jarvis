import React from 'react';
import { Home, Info, Lightbulb, Power, Shield, Thermometer, Tv } from 'lucide-react';
import { SmartDevice } from '../types/jarvis';

interface SmartHomeViewProps {
  devices: SmartDevice[];
  onToggleDevice: (id: string) => void;
  onApplyScene: (scene: 'LAB_FOCUS' | 'STEALTH' | 'ALL_ACTIVE') => void;
}

export const SmartHomeView: React.FC<SmartHomeViewProps> = ({
  devices,
  onToggleDevice,
  onApplyScene,
}) => {
  const iconForType = (type: SmartDevice['type']) => {
    switch (type) {
      case 'LIGHT':
        return Lightbulb;
      case 'CLIMATE':
        return Thermometer;
      case 'SECURITY':
        return Shield;
      default:
        return Tv;
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-4 flex items-start gap-3 border border-amber-500/35 bg-amber-500/5">
        <Info className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-mono-hud font-bold text-amber-300">
            LOCAL SMART HOME SIMULATION BRIDGE
          </p>
          <p>
            Device states are persisted locally in browser storage to mirror the Android Smart Home module. Connect a Home Assistant REST webhook URL + Long-Lived Access Token in backend configuration for physical IoT hardware actuation.
          </p>
        </div>
      </div>

      {/* Scene Presets */}
      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            ENVIRONMENT SCENE PROFILES
          </h3>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onApplyScene('LAB_FOCUS')}
            className="px-4 py-2 rounded-xl bg-cyan-400/15 border border-cyan-400/50 text-cyan-200 font-mono-hud text-xs cursor-pointer hover:bg-cyan-400/25"
          >
            STARK LAB FOCUS
          </button>
          <button
            type="button"
            onClick={() => onApplyScene('STEALTH')}
            className="px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-400/50 text-violet-200 font-mono-hud text-xs cursor-pointer hover:bg-violet-500/25"
          >
            STEALTH NIGHT LOCK
          </button>
          <button
            type="button"
            onClick={() => onApplyScene('ALL_ACTIVE')}
            className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 font-mono-hud text-xs cursor-pointer hover:bg-emerald-500/25"
          >
            FULL POWER MATRIX
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {devices.map((dev) => {
          const Icon = iconForType(dev.type);
          return (
            <div
              key={dev.id}
              className={`glass-panel rounded-2xl p-5 flex flex-col justify-between gap-4 border transition-colors ${
                dev.isOn ? 'border-cyan-400/45' : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      dev.isOn ? 'bg-cyan-400/15 text-cyan-300' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">{dev.name}</h4>
                    <p className="font-mono-hud text-[11px] text-slate-400">
                      {dev.room} • {dev.type}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleDevice(dev.id)}
                  aria-label={`Toggle ${dev.name}`}
                  className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                    dev.isOn
                      ? 'bg-cyan-400 text-[#02040A] border-cyan-300'
                      : 'bg-[#040812] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono-hud text-xs">
                <span className="text-slate-400">TELEMETRY</span>
                <span className={dev.isOn ? 'text-cyan-300' : 'text-slate-500'}>
                  {dev.isOn ? dev.value : 'STANDBY'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
