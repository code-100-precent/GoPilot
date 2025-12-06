import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import NotFound from "@/pages/NotFound.tsx";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary.tsx";
import Editor from "@/pages/Editor.tsx";
import DevErrorHandler from "@/components/Dev/DevErrorHandler.tsx";

function App() {

    return (
        <ErrorBoundary>
            <Router>
                <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    <Routes>
                        <Route path="/" element={<Editor />} />
                        <Route path="*" element={<NotFound />}/>
                    </Routes>

                    {/* 开发环境错误处理 */}
                    <DevErrorHandler />
                </div>
            </Router>
        </ErrorBoundary>
    );
}

export default App;