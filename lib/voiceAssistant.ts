import { Platform } from 'react-native';

type VoiceType = 'female' | 'male';

interface VoiceCallbacks {
  onStepStart?: (index: number) => void;
  onStepComplete?: (index: number) => void;
  onFinished?: () => void;
  onError?: (error: Error | string) => void;
}

class VoiceAssistant {
  private currentStepIndex: number = 0;
  private steps: string[] = [];
  private callbacks: VoiceCallbacks = {};
  private isActive: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private selectedVoice: VoiceType = 'female';

  constructor() {
    if (Platform.OS === 'web') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      }
    }
  }

  private getVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    
    const voices = this.synth.getVoices();
    
    if (this.selectedVoice === 'female') {
      const femaleVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('female') ||
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('zira') ||
        voice.name.toLowerCase().includes('victoria') ||
        (voice.name.toLowerCase().includes('google') && voice.name.toLowerCase().includes('us') && !voice.name.toLowerCase().includes('male'))
      );
      if (femaleVoice) return femaleVoice;
    } else {
      const maleVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('male') ||
        voice.name.toLowerCase().includes('daniel') ||
        voice.name.toLowerCase().includes('david') ||
        voice.name.toLowerCase().includes('alex')
      );
      if (maleVoice) return maleVoice;
    }
    
    return voices.find(voice => voice.lang.startsWith('en')) || voices[0] || null;
  }

  private speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (Platform.OS === 'web' && this.synth) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = this.getVoice();
        
        if (voice) {
          utterance.voice = voice;
        }
        
        utterance.rate = 0.9;
        utterance.pitch = this.selectedVoice === 'female' ? 1.1 : 0.9;
        
        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);
        
        this.synth.speak(utterance);
      } else {
        console.log('🔊 TTS:', text);
        setTimeout(() => resolve(), 1000);
      }
    });
  }

  private startListening() {
    if (!this.recognition) {
      console.log('🎤 Speech recognition not available');
      return;
    }

    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase();
      
      console.log('🎤 Heard:', transcript);
      
      if (transcript.includes('step complete') || 
          transcript.includes('next step') || 
          transcript.includes('done')) {
        this.handleStepComplete();
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('🎤 Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        this.recognition?.start();
      }
    };

    this.recognition.onend = () => {
      if (this.isActive) {
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (e) {
            console.error('Error restarting recognition:', e);
          }
        }, 100);
      }
    };

    try {
      this.recognition.start();
      console.log('🎤 Listening started');
    } catch (e) {
      console.error('Error starting recognition:', e);
    }
  }

  private async handleStepComplete() {
    if (!this.isActive) return;
    
    console.log('✅ Step', this.currentStepIndex, 'completed');
    
    if (this.callbacks.onStepComplete) {
      this.callbacks.onStepComplete(this.currentStepIndex);
    }
    
    this.currentStepIndex++;
    
    if (this.currentStepIndex < this.steps.length) {
      if (this.callbacks.onStepStart) {
        this.callbacks.onStepStart(this.currentStepIndex);
      }
      
      await this.speak(this.steps[this.currentStepIndex]);
      await this.speak("When you're ready, just say 'step complete'.");
    } else {
      await this.speak("Awesome, hope you enjoy your meal.");
      this.stopRecipeSession();
      
      if (this.callbacks.onFinished) {
        this.callbacks.onFinished();
      }
    }
  }

  async startRecipeSession(
    steps: string[],
    voice: VoiceType,
    callbacks: VoiceCallbacks
  ) {
    if (this.isActive) {
      console.log('⚠️ Session already active');
      return;
    }

    if (Platform.OS === 'web' && this.synth && this.synth.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        this.synth!.onvoiceschanged = () => resolve();
        setTimeout(() => resolve(), 1000);
      });
    }

    this.steps = steps;
    this.selectedVoice = voice;
    this.callbacks = callbacks;
    this.currentStepIndex = 0;
    this.isActive = true;

    console.log('🎙️ Starting recipe session with', steps.length, 'steps');
    console.log('🔊 Using voice:', voice);

    try {
      await this.speak("So you're ready to start making this recipe? Let's start with step one.");
      await this.speak(this.steps[0]);
      await this.speak("When you're ready, just say 'step complete'.");
      
      if (this.callbacks.onStepStart) {
        this.callbacks.onStepStart(0);
      }
      
      this.startListening();
    } catch (error) {
      console.error('Error starting session:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : String(error));
      }
      this.stopRecipeSession();
    }
  }

  stopRecipeSession() {
    console.log('🛑 Stopping recipe session');
    
    this.isActive = false;
    
    if (Platform.OS === 'web' && this.synth) {
      this.synth.cancel();
    }
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    this.steps = [];
    this.callbacks = {};
    this.currentStepIndex = 0;
  }
}

const voiceAssistant = new VoiceAssistant();

export const startRecipeSession = (
  steps: string[],
  voice: VoiceType,
  callbacks: VoiceCallbacks
) => voiceAssistant.startRecipeSession(steps, voice, callbacks);

export const stopRecipeSession = () => voiceAssistant.stopRecipeSession();
