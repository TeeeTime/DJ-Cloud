package de.djcloud.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * The track-analysis pipeline processes exactly one track at a time, in submission order — a
 * single-threaded, unbounded-queue executor gives that "one at a time, in order" behavior for free.
 */
@Configuration
public class AsyncConfig {

    @Bean(name = "trackAnalysisExecutor")
    public ThreadPoolTaskExecutor trackAnalysisExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(Integer.MAX_VALUE);
        executor.setThreadNamePrefix("track-analysis-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
