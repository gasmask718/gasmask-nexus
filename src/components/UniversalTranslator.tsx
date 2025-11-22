import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, Volume2, Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function UniversalTranslator() {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("es");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const languages = [
    { code: "auto", name: "Auto-detect" },
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
  ];

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast.error("Please enter text to translate");
      return;
    }

    setIsTranslating(true);
    try {
      // Mock translation for demo - in production, call translation API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simple demo translations
      const translations: Record<string, Record<string, string>> = {
        "hello": { es: "hola", fr: "bonjour" },
        "goodbye": { es: "adiós", fr: "au revoir" },
        "thank you": { es: "gracias", fr: "merci" },
      };

      const lowerInput = inputText.toLowerCase();
      const result = translations[lowerInput]?.[targetLang] || `[${targetLang}] ${inputText}`;
      
      setTranslatedText(result);
      toast.success("Translation complete");
    } catch (error) {
      console.error("Translation error:", error);
      toast.error("Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    try {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = sourceLang === "auto" ? "en-US" : `${sourceLang}-${sourceLang.toUpperCase()}`;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Listening...");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error("Voice input failed");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (error) {
      console.error("Voice input error:", error);
      toast.error("Voice input failed");
      setIsListening(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (!text) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang === "es" ? "es-ES" : targetLang === "fr" ? "fr-FR" : "en-US";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Languages className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Universal Translator</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.filter(l => l.code !== "auto").map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Textarea
              placeholder="Enter text to translate..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={3}
              className="flex-1"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={handleVoiceInput}
              disabled={isListening}
            >
              {isListening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Button 
            onClick={handleTranslate} 
            disabled={isTranslating}
            className="w-full"
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="h-4 w-4 mr-2" />
                Translate
              </>
            )}
          </Button>
        </div>

        {translatedText && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
              <p className="flex-1">{translatedText}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleSpeak(translatedText)}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
