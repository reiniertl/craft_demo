package com.example.clock;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        long millis = System.currentTimeMillis();
        long totalSeconds = millis / 1000;
        long hours = (totalSeconds / 3600) % 24;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;

        StringBuilder sb = new StringBuilder();
        sb.append(hours);
        sb.append(":");
        if (minutes < 10) sb.append("0");
        sb.append(minutes);
        sb.append(":");
        if (seconds < 10) sb.append("0");
        sb.append(seconds);

        TextView textView = new TextView(this);
        textView.setText(sb.toString());
        textView.setTextSize(48.0f);
        textView.setTextColor(0xFF000000);
        setContentView(textView);
    }
}
